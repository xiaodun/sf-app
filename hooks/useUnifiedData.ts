import { useCallback, useEffect, useRef, useState } from "react";

import UnifiedDataManager from "@/utils/unifiedDataManager";
import UnifiedStorage from "@/utils/unifiedStorage";

import type { DataStructure } from "@/types/dataStructure";

/**
 * 统一数据管理 Hook
 * @description 提供统一数据管理器的实例和常用操作
 */
export function useUnifiedData(initialData?: DataStructure) {
  const [dataManager] = useState(() => new UnifiedDataManager(initialData));
  const [data, setData] = useState<DataStructure>(dataManager.getData());
  const [loading, setLoading] = useState(true);
  const dataRef = useRef<DataStructure>(data);

  /**
   * 加载数据
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 使用统一存储加载数据（会自动处理迁移）
      const loadedData = await UnifiedStorage.loadUnifiedData();
      dataManager.setData(loadedData);
      dataRef.current = { ...loadedData };
      setData(dataRef.current);
    } catch (error) {
      console.error("加载数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  /**
   * 保存数据
   */
  const saveData = useCallback(async () => {
    try {
      const currentData = dataManager.getData();
      await UnifiedStorage.saveUnifiedData(currentData);
    } catch (error) {
      console.error("保存数据失败:", error);
      throw error;
    }
  }, [dataManager]);

  /**
   * 更新数据并触发重新渲染和保存
   */
  const updateData = useCallback(async () => {
    const currentData = dataManager.getData();
    // 总是更新 data state，确保 UI 能及时响应
    dataRef.current = { ...currentData };
    setData({ ...currentData });
    await saveData();
  }, [dataManager, saveData]);

  /**
   * 导出数据到剪贴板
   */
  const exportData = useCallback(() => {
    const success = dataManager.copyToClipboard();
    return success;
  }, [dataManager]);

  /**
   * 从剪贴板导入数据
   */
  const importData = useCallback(async () => {
    const success = await dataManager.pasteFromClipboard();
    if (success) {
      await updateData();
    }
    return success;
  }, [dataManager, updateData]);

  /**
   * 导出JSON字符串
   */
  const exportJSON = useCallback(() => {
    return dataManager.exportToJSON();
  }, [dataManager]);

  /**
   * 导入JSON字符串
   */
  const importJSON = useCallback(
    async (jsonString: string) => {
      const success = dataManager.importFromJSON(jsonString);
      if (success) {
        await updateData();
      }
      return success;
    },
    [dataManager, updateData]
  );

  // 初始化时加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    dataManager,
    data,
    loading,
    updateData,
    saveData,
    exportData,
    importData,
    exportJSON,
    importJSON,
  };
}




