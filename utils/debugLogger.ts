import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// 动态导入 expo-file-system，避免在 Web 平台报错
let FileSystem: any = null;
if (Platform.OS !== "web") {
  try {
    FileSystem = require("expo-file-system");
  } catch (e) {
    console.warn("expo-file-system not available");
  }
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  category: string;
  message: string;
  data?: any;
  stack?: string;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 最多保存1000条日志
  private storageKey = "@sf_app_debug_logs";
  private isEnabled = __DEV__ || true; // 生产环境也启用
  private logsLoaded = false; // 标记是否已加载过日志

  constructor() {
    // 初始化时就加载日志
    this.loadLogs().catch((error) => {
      console.error("加载日志失败:", error);
    });
    // 捕获全局错误
    if (typeof ErrorUtils !== "undefined") {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        this.error("GlobalError", "全局错误捕获", {
          error: error.message,
          stack: error.stack,
          isFatal,
        });
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  }

  private async loadLogs() {
    if (this.logsLoaded) return; // 已经加载过就不再加载
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 只加载非空数组
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 将加载的日志与现有日志合并，避免丢失
          this.logs = [...parsed, ...this.logs];
          // 确保不超过最大日志数量
          if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
          }
        }
      }
      this.logsLoaded = true;
      console.log(`日志加载完成: ${this.logs.length} 条记录`);
    } catch (error) {
      console.error("加载日志失败:", error);
      this.logsLoaded = true; // 即使失败也标记为已加载，避免重复尝试
    }
  }

  private async saveLogs() {
    try {
      // 只保留最近的日志
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    } catch (error) {
      console.warn("保存日志失败:", error);
    }
  }

  private addLog(
    level: LogEntry["level"],
    category: string,
    message: string,
    data?: any,
    error?: Error
  ) {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      stack: error?.stack,
    };

    this.logs.push(entry);
    this.saveLogs();

    // 同时输出到控制台
    const logMessage = `[${category}] ${message}`;
    switch (level) {
      case "error":
        console.error(logMessage, data || error);
        break;
      case "warn":
        console.warn(logMessage, data);
        break;
      case "debug":
        console.log(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }
  }

  info(category: string, message: string, data?: any) {
    this.addLog("info", category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.addLog("warn", category, message, data);
  }

  error(category: string, message: string, data?: any, error?: Error) {
    this.addLog("error", category, message, data, error);
  }

  debug(category: string, message: string, data?: any) {
    this.addLog("debug", category, message, data);
  }

  async ensureLogsLoaded() {
    if (!this.logsLoaded) {
      await this.loadLogs();
    }
  }

  getLogs(limit?: number): LogEntry[] {
    // 直接返回当前日志，不做任何处理
    const logs = this.logs;
    if (limit) {
      return logs.slice(-limit);
    }
    return [...logs];
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter((log) => log.category === category);
  }

  async exportLogs(): Promise<string> {
    try {
      const logsJson = JSON.stringify(this.logs, null, 2);
      const fileName = `sf-app-logs-${new Date().toISOString().replace(/:/g, "-")}.json`;
      
      if (Platform.OS === "web") {
        // Web平台：下载文件
        const blob = new Blob([logsJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return fileName;
      } else {
        // 移动平台：保存到文件系统
        if (FileSystem) {
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, logsJson);
          this.info("DebugLogger", `日志已导出到: ${fileUri}`);
          return fileUri;
        } else {
          // 如果 FileSystem 不可用，使用 AsyncStorage
          await AsyncStorage.setItem(`@exported_logs_${Date.now()}`, logsJson);
          this.info("DebugLogger", `日志已保存到 AsyncStorage`);
          return "AsyncStorage";
        }
      }
    } catch (error) {
      this.error("DebugLogger", "导出日志失败", undefined, error as Error);
      throw error;
    }
  }

  async clearLogs() {
    console.log("[DebugLogger] 开始清空日志, storageKey:", this.storageKey);
    console.log("[DebugLogger] 清空前 - 内存日志数量:", this.logs.length);
    
    // 先清空内存
    this.logs = [];
    this.logsLoaded = true; // 标记为已加载，避免重新加载旧数据
    
    try {
      // 检查清空前存储中的内容
      const beforeClear = await AsyncStorage.getItem(this.storageKey);
      console.log("[DebugLogger] 清空前 - 存储中的数据:", beforeClear ? `存在 (${beforeClear.length} 字符)` : "不存在");
      
      // Web 平台：检查 localStorage
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        const beforeLocalStorage = window.localStorage.getItem(this.storageKey);
        console.log("[DebugLogger] 清空前 - localStorage中的数据:", beforeLocalStorage ? `存在 (${beforeLocalStorage.length} 字符)` : "不存在");
        
        // 列出所有 localStorage keys（用于调试）
        console.log("[DebugLogger] localStorage 所有 keys:", Object.keys(window.localStorage));
      }
      
      // 方法1：使用 AsyncStorage 清空
      console.log("[DebugLogger] 步骤1: 使用 AsyncStorage.removeItem 清空");
      await AsyncStorage.removeItem(this.storageKey);
      
      // 方法2：Web 平台直接操作 localStorage
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        console.log("[DebugLogger] 步骤2: 直接操作 localStorage.removeItem");
        window.localStorage.removeItem(this.storageKey);
      }
      
      // 验证第一次清空
      const afterFirstClear = await AsyncStorage.getItem(this.storageKey);
      console.log("[DebugLogger] 第一次清空后 - AsyncStorage:", afterFirstClear ? `还存在 (${afterFirstClear.length} 字符)` : "已清空");
      
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        const afterFirstLocalStorage = window.localStorage.getItem(this.storageKey);
        console.log("[DebugLogger] 第一次清空后 - localStorage:", afterFirstLocalStorage ? `还存在 (${afterFirstLocalStorage.length} 字符)` : "已清空");
      }
      
      // 方法3：设置为空数组后删除（最后的保障）
      console.log("[DebugLogger] 步骤3: 设置为空数组后删除");
      await AsyncStorage.setItem(this.storageKey, JSON.stringify([]));
      await AsyncStorage.removeItem(this.storageKey);
      
      // Web平台再次确认
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        console.log("[DebugLogger] 步骤4: Web平台再次确认");
        window.localStorage.removeItem(this.storageKey);
      }
      
      // 最终验证
      const finalCheck = await AsyncStorage.getItem(this.storageKey);
      console.log("[DebugLogger] 最终验证 - AsyncStorage:", finalCheck ? `失败！还存在 (${finalCheck.length} 字符)` : "成功！已清空");
      
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        const finalLocalStorage = window.localStorage.getItem(this.storageKey);
        console.log("[DebugLogger] 最终验证 - localStorage:", finalLocalStorage ? `失败！还存在 (${finalLocalStorage.length} 字符)` : "成功！已清空");
        
        // 如果还存在，尝试所有可能的key变体
        if (finalLocalStorage) {
          console.log("[DebugLogger] 尝试清空所有可能的key变体");
          const allKeys = Object.keys(window.localStorage);
          allKeys.forEach(key => {
            if (key.includes('debug') || key.includes('log') || key === this.storageKey) {
              console.log("[DebugLogger] 删除key:", key);
              window.localStorage.removeItem(key);
            }
          });
        }
      }
      
      console.log("[DebugLogger] 清空日志完成");
    } catch (error) {
      console.error("[DebugLogger] 清空日志失败:", error);
      console.error("[DebugLogger] 错误堆栈:", (error as Error).stack);
      // 即使失败也清空内存
      this.logs = [];
      
      // Web平台最后的保障
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        try {
          console.log("[DebugLogger] 错误处理: 尝试直接清空 localStorage");
          window.localStorage.removeItem(this.storageKey);
        } catch (e) {
          console.error("[DebugLogger] 错误处理也失败:", e);
        }
      }
    }
  }

  getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      // 可以添加更多设备信息
    };
  }
}

export const debugLogger = new DebugLogger();

// 导出便捷方法
export const logInfo = (category: string, message: string, data?: any) => {
  debugLogger.info(category, message, data);
};

export const logWarn = (category: string, message: string, data?: any) => {
  debugLogger.warn(category, message, data);
};

export const logError = (
  category: string,
  message: string,
  data?: any,
  error?: Error
) => {
  debugLogger.error(category, message, data, error);
};

export const logDebug = (category: string, message: string, data?: any) => {
  debugLogger.debug(category, message, data);
};

