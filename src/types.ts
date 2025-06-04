export interface ConsoleKeeperOptions {
  /** 需要处理的文件范围 */
  includes?: Array<
    | "debug"
    | "error"
    | "info"
    | "log"
    | "warn"
    | "dir"
    | "dirxml"
    | "table"
    | "trace"
    | "group"
    | "groupCollapsed"
    | "groupEnd"
    | "clear"
    | "count"
    | "countReset"
    | "assert"
    | "profile"
    | "profileEnd"
    | "time"
    | "timeLog"
    | "timeEnd"
    | "timeStamp"
    | "context"
    | "createTask"
    | "memory"
  >;
  external?: Array<string | RegExp>;
  /** 需要保留的console方法的注释 */
  keepComments?: Array<string>;
}
