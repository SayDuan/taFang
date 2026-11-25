/**
 * Creator 播放后端。按正式原名到 assets/resources/audio/ 下查找。
 * 素材安装：音频/音效/ → assets/resources/audio/音效/，音频/音乐/ → assets/resources/audio/音乐/，保持原名。
 * 找不到文件时在控制台打出正式名，不要用别的文件冒充。
 */
import { AudioClip, AudioSource, Node, resources } from 'cc';
import { hookSoundBackend, type SoundBackend, type SoundId } from '../sim/Sound';
import { AUDIO_RESOURCE_CANDIDATES, isMusicName } from '../sim/SoundTable';

let installed = false;
let host: Node | null = null;
let sfxSource: AudioSource | null = null;
let musicSource: AudioSource | null = null;
const clips = new Map<string, AudioClip | null>();
const inflight = new Map<string, Promise<AudioClip | null>>();

function ensureSources(): void {
    if (sfxSource && musicSource && host && host.isValid) {
        return;
    }
    host = new Node('GameAudioRoot');
    sfxSource = host.addComponent(AudioSource);
    sfxSource.loop = false;
    sfxSource.playOnAwake = false;
    musicSource = host.addComponent(AudioSource);
    musicSource.loop = true;
    musicSource.playOnAwake = false;
}

function clipKey(id: SoundId): string {
    return String(id).replace(/\.(ogg|mp3|wav|m4a)$/i, '');
}

function candidatePaths(name: string): string[] {
    const paths: string[] = [];
    const seen = new Set<string>();
    const kind = isMusicName(name) ? 'music' : 'sfx';
    const dirs = kind === 'music'
        ? ['audio/音乐/', 'audio/音效/', 'audio/']
        : ['audio/音效/', 'audio/音乐/', 'audio/'];
    for (const dir of dirs) {
        const p = `${dir}${name}`;
        if (!seen.has(p)) {
            seen.add(p);
            paths.push(p);
        }
    }
    for (const dir of AUDIO_RESOURCE_CANDIDATES) {
        const p = `${dir}${name}`;
        if (!seen.has(p)) {
            seen.add(p);
            paths.push(p);
        }
    }
    return paths;
}

function loadClip(name: string): Promise<AudioClip | null> {
    if (clips.has(name)) {
        return Promise.resolve(clips.get(name) ?? null);
    }
    const pending = inflight.get(name);
    if (pending) {
        return pending;
    }
    const job = new Promise<AudioClip | null>((resolve) => {
        const paths = candidatePaths(name);
        const tryNext = (i: number) => {
            if (i >= paths.length) {
                console.warn('[Audio] 没有找到', name, paths.join(' | '));
                clips.set(name, null);
                inflight.delete(name);
                resolve(null);
                return;
            }
            resources.load(paths[i], AudioClip, (err, clip) => {
                if (!err && clip) {
                    clips.set(name, clip);
                    inflight.delete(name);
                    resolve(clip);
                    return;
                }
                tryNext(i + 1);
            });
        };
        tryNext(0);
    });
    inflight.set(name, job);
    return job;
}

const backend: SoundBackend = {
    playSfx(id: SoundId): void {
        ensureSources();
        const name = clipKey(id);
        void loadClip(name).then((clip) => {
            if (!clip || !sfxSource || !sfxSource.isValid) {
                return;
            }
            sfxSource.playOneShot(clip, 1);
        });
    },
    setBackgroundLoop(id: SoundId): void {
        ensureSources();
        const name = clipKey(id);
        void loadClip(name).then((clip) => {
            if (!clip || !musicSource || !musicSource.isValid) {
                return;
            }
            if (musicSource.playing) {
                musicSource.stop();
            }
            musicSource.clip = clip;
            musicSource.loop = true;
            musicSource.play();
        });
    },
    stopBackgroundLoop(): void {
        if (musicSource && musicSource.isValid && musicSource.playing) {
            musicSource.stop();
        }
    },
};

export function installGameAudio(): void {
    if (installed) {
        return;
    }
    installed = true;
    hookSoundBackend(backend);
}

export function isGameAudioInstalled(): boolean {
    return installed;
}
