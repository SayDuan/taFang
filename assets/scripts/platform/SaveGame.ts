/**
 * 平台存档入口：本地键值存储。
 * 中途档字段和战斗序列化仍在 sim/SaveGame，两边共用这一份存储实现。
 */
export {
    MemoryStore,
    createLocalStore,
    type KeyValueStore,
} from './LocalStore';
