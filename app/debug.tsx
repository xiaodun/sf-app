import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { debugLogger, LogEntry } from "@/utils/debugLogger";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Clipboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function DebugScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "error" | "warn" | "info" | "debug">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
    // 每2秒刷新一次日志
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async () => {
    await debugLogger.ensureLogsLoaded();
    const allLogs = debugLogger.getLogs();
    setLogs(allLogs);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter !== "all" && log.level !== filter) return false;
    if (selectedCategory && log.category !== selectedCategory) return false;
    return true;
  });

  const categories = Array.from(new Set(logs.map((log) => log.category)));

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "#FF3B30";
      case "warn":
        return "#FF9500";
      case "info":
        return "#007AFF";
      case "debug":
        return "#8E8E93";
      default:
        return "#000000";
    }
  };

  const handleExport = async () => {
    try {
      const logsJson = JSON.stringify(logs, null, 2);
      Clipboard.setString(logsJson);
      Alert.alert("复制成功", "日志已复制到剪贴板");
    } catch (error) {
      Alert.alert("复制失败", (error as Error).message);
    }
  };

  const handleClear = async () => {
    await debugLogger.clearLogs();
    setLogs([]); // 立即清空界面显示的日志，不重新加载
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.toLocaleTimeString()}`;
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: "调试日志",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>级别:</Text>
          {(["all", "error", "warn", "info", "debug"] as const).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.filterButton,
                filter === level && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(level)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === level && styles.filterButtonTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>分类:</Text>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedCategory === null && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedCategory === null && styles.filterButtonTextActive,
              ]}
            >
              全部
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterButton,
                selectedCategory === category && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedCategory === category && styles.filterButtonTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleExport}>
            <MaterialIcons name="content-copy" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>复制到剪贴板</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton]}
            onPress={handleClear}
          >
            <MaterialIcons name="delete" size={20} color="#FF3B30" />
            <Text style={[styles.actionButtonText, styles.clearButtonText]}>
              清空
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 日志列表 */}
      <ScrollView style={styles.logsContainer}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>暂无日志</ThemedText>
          </View>
        ) : (
          filteredLogs.map((log, index) => (
            <View key={index} style={styles.logItem}>
              <View style={styles.logHeader}>
                <View
                  style={[
                    styles.logLevelBadge,
                    { backgroundColor: getLogColor(log.level) },
                  ]}
                >
                  <Text style={styles.logLevelText}>{log.level}</Text>
                </View>
                <Text style={styles.logCategory}>{log.category}</Text>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
              {log.data && (
                <Text style={styles.logData}>
                  {JSON.stringify(log.data, null, 2)}
                </Text>
              )}
              {log.stack && (
                <Text style={styles.logStack}>{log.stack}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 统计信息 */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          总计: {logs.length} | 错误: {logs.filter((l) => l.level === "error").length} | 警告:{" "}
          {logs.filter((l) => l.level === "warn").length}
        </Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
  },
  toolbar: {
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
    color: "#333",
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
    marginRight: 8,
    marginBottom: 4,
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
  },
  filterButtonText: {
    fontSize: 12,
    color: "#666",
  },
  filterButtonTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 8,
    justifyContent: "space-around",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: "#E3F2FD",
  },
  actionButtonText: {
    marginLeft: 4,
    color: "#007AFF",
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: "#FFEBEE",
  },
  clearButtonText: {
    color: "#FF3B30",
  },
  logsContainer: {
    flex: 1,
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
  logItem: {
    backgroundColor: "#FFF",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#E0E0E0",
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  logLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
   },
  logLevelText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  logCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  logTime: {
    fontSize: 10,
    color: '#999',
    marginLeft: 'auto',
  },
  logMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  logData: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  logStack: {
    fontSize: 10,
    color: '#FF3B30',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  stats: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
