import AsyncStorage from "@react-native-async-storage/async-storage";

const COLLECTIONS_KEY = "@sf_app:collections";
const LEVELS_KEY = "@sf_app:levels";
const FEATURES_KEY = "@sf_app:features";
const UNIT_FEATURES_KEY = "@sf_app:unit_features";
const RECOMMENDED_UNITS_KEY = "@sf_app:recommended_units";
const TRASHED_UNITS_KEY = "@sf_app:trashed_units";
const FAVORITE_UNITS_KEY = "@sf_app:favorite_units";

export interface Feature {
  id: string;
  collectionId: string;
  name: string;
  type: "numeric" | "single_choice"; // 数值或单选
  createdAt: number;
}

export interface UnitFeature {
  unitId: string;
  featureId: string;
  value: number | boolean; // 数值类型存储数字，单选类型存储布尔值
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Level {
  id: string;
  collectionId: string;
  name: string;
  identifier: "numeric" | "alpha"; // 标识类型：数字或英文
  units: Unit[]; // 单元列表
  createdAt: number;
}

/**
 * 保存集合列表到本地存储
 */
export async function saveCollections(
  collections: Collection[]
): Promise<void> {
  try {
    const jsonValue = JSON.stringify(collections);
    await AsyncStorage.setItem(COLLECTIONS_KEY, jsonValue);
  } catch (error) {
    console.error("保存集合数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载集合列表
 */
export async function loadCollections(): Promise<Collection[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(COLLECTIONS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error("加载集合数据失败:", error);
    return [];
  }
}

/**
 * 保存层级列表到本地存储
 */
export async function saveLevels(levels: Level[]): Promise<void> {
  try {
    const jsonValue = JSON.stringify(levels);
    await AsyncStorage.setItem(LEVELS_KEY, jsonValue);
  } catch (error) {
    console.error("保存层级数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载层级列表
 */
export async function loadLevels(): Promise<Level[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(LEVELS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error("加载层级数据失败:", error);
    return [];
  }
}

/**
 * 根据集合ID获取层级列表
 */
export async function loadLevelsByCollectionId(
  collectionId: string
): Promise<Level[]> {
  try {
    const allLevels = await loadLevels();
    return allLevels.filter((level) => level.collectionId === collectionId);
  } catch (error) {
    console.error("加载层级数据失败:", error);
    return [];
  }
}

/**
 * 保存特性列表到本地存储
 */
export async function saveFeatures(features: Feature[]): Promise<void> {
  try {
    const jsonValue = JSON.stringify(features);
    await AsyncStorage.setItem(FEATURES_KEY, jsonValue);
  } catch (error) {
    console.error("保存特性数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载特性列表
 */
export async function loadFeatures(): Promise<Feature[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(FEATURES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error("加载特性数据失败:", error);
    return [];
  }
}

/**
 * 清空所有特性数据
 */
export async function clearFeatures(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FEATURES_KEY);
  } catch (error) {
    console.error("清空特性数据失败:", error);
    throw error;
  }
}

/**
 * 根据集合ID获取特性列表
 */
export async function loadFeaturesByCollectionId(
  collectionId: string
): Promise<Feature[]> {
  try {
    const allFeatures = await loadFeatures();
    return allFeatures.filter(
      (feature) => feature.collectionId === collectionId
    );
  } catch (error) {
    console.error("加载特性数据失败:", error);
    return [];
  }
}

/**
 * 保存单元特性到本地存储
 */
export async function saveUnitFeatures(
  unitFeatures: UnitFeature[]
): Promise<void> {
  try {
    const jsonValue = JSON.stringify(unitFeatures);
    await AsyncStorage.setItem(UNIT_FEATURES_KEY, jsonValue);
  } catch (error) {
    console.error("保存单元特性数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载单元特性
 */
export async function loadUnitFeatures(): Promise<UnitFeature[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(UNIT_FEATURES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error("加载单元特性数据失败:", error);
    return [];
  }
}

export interface RecommendedUnit {
  unit: Unit;
  levelName: string;
  levelId: string;
  collectionId: string;
}

export interface TrashedUnit {
  unit: Unit;
  levelName: string;
  levelId: string;
  collectionId: string;
}

export interface FavoriteUnit {
  unit: Unit;
  levelName: string;
  levelId: string;
  collectionId: string;
  reason: string; // 收藏原因
  createdAt: number;
}

/**
 * 保存推荐单元到本地存储（按集合ID存储）
 */
export async function saveRecommendedUnits(
  collectionId: string,
  recommendedUnits: RecommendedUnit[]
): Promise<void> {
  try {
    const allDataJson = await AsyncStorage.getItem(RECOMMENDED_UNITS_KEY);
    const allData = allDataJson != null ? JSON.parse(allDataJson) : {};
    allData[collectionId] = recommendedUnits;
    await AsyncStorage.setItem(RECOMMENDED_UNITS_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error("保存推荐单元数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载推荐单元（按集合ID）
 */
export async function loadRecommendedUnits(
  collectionId: string
): Promise<RecommendedUnit[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(RECOMMENDED_UNITS_KEY);
    if (jsonValue == null) return [];
    const allData = JSON.parse(jsonValue);
    return allData[collectionId] || [];
  } catch (error) {
    console.error("加载推荐单元数据失败:", error);
    return [];
  }
}

/**
 * 保存回收站单元到本地存储（按集合ID存储）
 */
export async function saveTrashedUnits(
  collectionId: string,
  trashedUnits: TrashedUnit[]
): Promise<void> {
  try {
    const allDataJson = await AsyncStorage.getItem(TRASHED_UNITS_KEY);
    const allData = allDataJson != null ? JSON.parse(allDataJson) : {};
    allData[collectionId] = trashedUnits;
    await AsyncStorage.setItem(TRASHED_UNITS_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error("保存回收站单元数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载回收站单元（按集合ID）
 */
export async function loadTrashedUnits(
  collectionId: string
): Promise<TrashedUnit[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(TRASHED_UNITS_KEY);
    if (jsonValue == null) return [];
    const allData = JSON.parse(jsonValue);
    return allData[collectionId] || [];
  } catch (error) {
    console.error("加载回收站单元数据失败:", error);
    return [];
  }
}

/**
 * 清空回收站数据（按集合ID）
 */
export async function clearTrashedUnits(collectionId: string): Promise<void> {
  try {
    const allDataJson = await AsyncStorage.getItem(TRASHED_UNITS_KEY);
    const allData = allDataJson != null ? JSON.parse(allDataJson) : {};
    allData[collectionId] = [];
    await AsyncStorage.setItem(TRASHED_UNITS_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error("清空回收站数据失败:", error);
    throw error;
  }
}

/**
 * 保存收藏单元到本地存储（按集合ID存储）
 */
export async function saveFavoriteUnits(
  collectionId: string,
  favoriteUnits: FavoriteUnit[]
): Promise<void> {
  try {
    const allDataJson = await AsyncStorage.getItem(FAVORITE_UNITS_KEY);
    const allData = allDataJson != null ? JSON.parse(allDataJson) : {};
    allData[collectionId] = favoriteUnits;
    await AsyncStorage.setItem(FAVORITE_UNITS_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error("保存收藏单元数据失败:", error);
    throw error;
  }
}

/**
 * 从本地存储加载收藏单元（按集合ID）
 */
export async function loadFavoriteUnits(
  collectionId: string
): Promise<FavoriteUnit[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(FAVORITE_UNITS_KEY);
    if (jsonValue == null) return [];
    const allData = JSON.parse(jsonValue);
    return allData[collectionId] || [];
  } catch (error) {
    console.error("加载收藏单元数据失败:", error);
    return [];
  }
}
