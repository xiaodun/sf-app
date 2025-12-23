import AsyncStorage from "@react-native-async-storage/async-storage";
import { Clipboard } from "react-native";

import type {
  Collection,
  DataStructure,
  Feature,
  Level,
  Unit,
  UnitStatus,
} from "@/types/dataStructure";

const DATA_KEY = "@sf_app:unified_data";

/**
 * 统一数据管理器
 * @description 管理所有数据，包括集合数组和特性
 */
class UnifiedDataManager {
  private data: DataStructure;

  constructor(initialData?: DataStructure) {
    this.data = initialData || {
      collections: [],
      features: {},
    };
  }

  /**
   * 获取完整数据
   */
  getData(): DataStructure {
    return this.data;
  }

  /**
   * 设置完整数据
   */
  setData(data: DataStructure): void {
    this.data = data;
  }

  // ========== 集合相关操作 ==========

  /**
   * 获取所有集合
   */
  getCollections(): Collection[] {
    return this.data.collections;
  }

  /**
   * 添加集合
   */
  addCollection(collection: Collection): void {
    this.data.collections.push(collection);
  }

  /**
   * 删除集合
   */
  removeCollection(collectionIndex: number): void {
    if (
      collectionIndex >= 0 &&
      collectionIndex < this.data.collections.length
    ) {
      this.data.collections.splice(collectionIndex, 1);
    }
  }

  /**
   * 更新集合
   */
  updateCollection(collectionIndex: number, collection: Collection): void {
    if (
      collectionIndex >= 0 &&
      collectionIndex < this.data.collections.length
    ) {
      this.data.collections[collectionIndex] = collection;
    }
  }

  /**
   * 根据索引获取集合
   */
  getCollection(collectionIndex: number): Collection | undefined {
    if (
      collectionIndex >= 0 &&
      collectionIndex < this.data.collections.length
    ) {
      return this.data.collections[collectionIndex];
    }
    return undefined;
  }

  /**
   * 根据集合ID获取集合索引
   */
  getCollectionIndexById(collectionId: string): number {
    return this.data.collections.findIndex((c) => c.id === collectionId);
  }

  // ========== 层次相关操作 ==========

  /**
   * 获取集合中的层次列表
   */
  getLevels(collectionIndex: number): Level[] {
    const collection = this.getCollection(collectionIndex);
    return collection?.levels || [];
  }

  /**
   * 添加层次到集合
   */
  addLevel(collectionIndex: number, level: Level): void {
    const collection = this.getCollection(collectionIndex);
    if (collection) {
      collection.levels.push(level);
    }
  }

  /**
   * 删除层次
   */
  removeLevel(collectionIndex: number, levelIndex: number): void {
    const collection = this.getCollection(collectionIndex);
    if (
      collection &&
      levelIndex >= 0 &&
      levelIndex < collection.levels.length
    ) {
      collection.levels.splice(levelIndex, 1);
    }
  }

  /**
   * 更新层次
   */
  updateLevel(collectionIndex: number, levelIndex: number, level: Level): void {
    const collection = this.getCollection(collectionIndex);
    if (
      collection &&
      levelIndex >= 0 &&
      levelIndex < collection.levels.length
    ) {
      collection.levels[levelIndex] = level;
    }
  }

  /**
   * 根据索引获取层次
   */
  getLevel(collectionIndex: number, levelIndex: number): Level | undefined {
    const collection = this.getCollection(collectionIndex);
    if (
      collection &&
      levelIndex >= 0 &&
      levelIndex < collection.levels.length
    ) {
      return collection.levels[levelIndex];
    }
    return undefined;
  }

  // ========== 单元相关操作 ==========

  /**
   * 获取层次中的单元列表
   */
  getUnits(collectionIndex: number, levelIndex: number): Unit[] {
    const level = this.getLevel(collectionIndex, levelIndex);
    return level?.units || [];
  }

  /**
   * 添加单元到层次
   */
  addUnit(collectionIndex: number, levelIndex: number, unit: Unit): void {
    const level = this.getLevel(collectionIndex, levelIndex);
    if (level) {
      level.units.push(unit);
    }
  }

  /**
   * 删除单元
   */
  removeUnit(
    collectionIndex: number,
    levelIndex: number,
    unitIndex: number
  ): void {
    const level = this.getLevel(collectionIndex, levelIndex);
    if (level && unitIndex >= 0 && unitIndex < level.units.length) {
      level.units.splice(unitIndex, 1);
    }
  }

  /**
   * 更新单元
   */
  updateUnit(
    collectionIndex: number,
    levelIndex: number,
    unitIndex: number,
    unit: Unit
  ): void {
    const level = this.getLevel(collectionIndex, levelIndex);
    if (level && unitIndex >= 0 && unitIndex < level.units.length) {
      level.units[unitIndex] = unit;
    }
  }

  /**
   * 更新单元状态
   */
  updateUnitStatus(
    collectionIndex: number,
    levelIndex: number,
    unitIndex: number,
    status: UnitStatus,
    favoriteReason?: string
  ): void {
    const level = this.getLevel(collectionIndex, levelIndex);
    if (level && unitIndex >= 0 && unitIndex < level.units.length) {
      const unit = level.units[unitIndex];
      unit.status = status;
      if (status === "favorite") {
        unit.favoriteReason = favoriteReason || "无";
        unit.favoriteCreatedAt = Date.now();
      } else {
        delete unit.favoriteReason;
        delete unit.favoriteCreatedAt;
      }
    }
  }

  /**
   * 根据单元ID查找单元（遍历所有集合、层次）
   */
  findUnit(unitId: string): {
    collectionIndex: number;
    levelIndex: number;
    unitIndex: number;
    unit: Unit;
  } | null {
    for (
      let collectionIndex = 0;
      collectionIndex < this.data.collections.length;
      collectionIndex++
    ) {
      const collection = this.data.collections[collectionIndex];
      for (
        let levelIndex = 0;
        levelIndex < collection.levels.length;
        levelIndex++
      ) {
        const level = collection.levels[levelIndex];
        const unitIndex = level.units.findIndex((u) => u.id === unitId);
        if (unitIndex !== -1) {
          return {
            collectionIndex,
            levelIndex,
            unitIndex,
            unit: level.units[unitIndex],
          };
        }
      }
    }
    return null;
  }

  // ========== 特性相关操作 ==========

  /**
   * 获取所有特性
   */
  getFeatures(): Record<string, Feature> {
    return this.data.features;
  }

  /**
   * 获取特性列表（数组形式）
   */
  getFeaturesArray(): Feature[] {
    return Object.values(this.data.features);
  }

  /**
   * 获取特性
   */
  getFeature(featureId: string): Feature | undefined {
    return this.data.features[featureId];
  }

  /**
   * 添加特性
   */
  addFeature(feature: Feature): void {
    this.data.features[feature.id] = feature;
  }

  /**
   * 更新特性
   */
  updateFeature(featureId: string, feature: Feature): void {
    if (this.data.features[featureId]) {
      this.data.features[featureId] = feature;
    }
  }

  /**
   * 删除特性
   * @description 遍历所有集合、层次、单元，删除关联的特性引用
   */
  removeFeature(featureId: string): void {
    // 遍历所有集合
    this.data.collections.forEach((collection) => {
      // 遍历集合中的所有层次
      collection.levels.forEach((level) => {
        // 遍历层次中的所有单元
        level.units.forEach((unit) => {
          // 从单元的特性列表中删除该特性
          unit.features = unit.features.filter(
            (f) => f.featureId !== featureId
          );
        });
      });
    });

    // 删除特性对象
    delete this.data.features[featureId];
  }

  // ========== 存储相关操作 ==========

  /**
   * 保存数据到本地存储
   */
  async save(): Promise<void> {
    try {
      const jsonValue = JSON.stringify(this.data);
      await AsyncStorage.setItem(DATA_KEY, jsonValue);
    } catch (error) {
      console.error("保存数据失败:", error);
      throw error;
    }
  }

  /**
   * 从本地存储加载数据
   */
  async load(): Promise<void> {
    try {
      const jsonValue = await AsyncStorage.getItem(DATA_KEY);
      if (jsonValue != null) {
        const parsedData = JSON.parse(jsonValue) as DataStructure;
        if (this.validateDataStructure(parsedData)) {
          this.data = parsedData;
        } else {
          console.warn("数据格式不正确，使用默认数据");
          this.data = {
            collections: [],
            features: {},
          };
        }
      }
    } catch (error) {
      console.error("加载数据失败:", error);
      this.data = {
        collections: [],
        features: {},
      };
    }
  }

  /**
   * 验证数据结构
   */
  private validateDataStructure(data: any): data is DataStructure {
    return (
      data &&
      Array.isArray(data.collections) &&
      typeof data.features === "object" &&
      data.features !== null
    );
  }

  // ========== 导入导出相关操作 ==========

  /**
   * 导出数据为JSON字符串
   */
  exportToJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * 从JSON字符串导入数据
   */
  importFromJSON(jsonString: string): boolean {
    try {
      const parsedData = JSON.parse(jsonString) as DataStructure;
      if (this.validateDataStructure(parsedData)) {
        this.data = parsedData;
        return true;
      }
      return false;
    } catch (error) {
      console.error("导入数据失败:", error);
      return false;
    }
  }

  /**
   * 复制数据到剪贴板
   */
  copyToClipboard(): boolean {
    try {
      const jsonString = this.exportToJSON();
      Clipboard.setString(jsonString);
      return true;
    } catch (error) {
      console.error("复制到剪贴板失败:", error);
      return false;
    }
  }

  /**
   * 从剪贴板读取数据
   */
  async pasteFromClipboard(): Promise<boolean> {
    try {
      const jsonString = await Clipboard.getString();
      if (jsonString) {
        return this.importFromJSON(jsonString);
      }
      return false;
    } catch (error) {
      console.error("从剪贴板读取失败:", error);
      return false;
    }
  }
}

export default UnifiedDataManager;
