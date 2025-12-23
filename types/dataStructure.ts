/**
 * 单元状态标记
 * @description 单元本身的状态标记，便于删除时处理
 */
export type UnitStatus = "normal" | "recommended" | "favorite" | "trash";

/**
 * 单元特性值
 * @description 单元关联的特性值
 */
export interface UnitFeatureValue {
  /**
   * 特性ID
   */
  featureId: string;
  /**
   * 特性值：数值类型存储数字，单选类型存储布尔值
   */
  value: number | boolean;
}

/**
 * 单元
 * @description 最小数据单位，包含状态标记和特性值
 */
export interface Unit {
  /**
   * 单元唯一标识
   */
  id: string;
  /**
   * 单元名称
   */
  name: string;
  /**
   * 单元状态标记：normal（正常）、recommended（推荐）、favorite（收藏）、trash（回收站）
   */
  status: UnitStatus;
  /**
   * 单元关联的特性值列表
   */
  features: UnitFeatureValue[];
  /**
   * 收藏原因（仅当 status 为 favorite 时有效）
   */
  favoriteReason?: string;
  /**
   * 收藏时间（仅当 status 为 favorite 时有效）
   */
  favoriteCreatedAt?: number;
}

/**
 * 层次
 * @description 包含多个单元
 */
export interface Level {
  /**
   * 层次唯一标识
   */
  id: string;
  /**
   * 层次名称
   */
  name: string;
  /**
   * 标识类型：数字或英文
   */
  identifier: "numeric" | "alpha";
  /**
   * 层次下的单元列表
   */
  units: Unit[];
  /**
   * 创建时间
   */
  createdAt: number;
}

/**
 * 集合
 * @description 包含集合元数据和层次数组
 */
export interface Collection {
  /**
   * 集合唯一标识
   */
  id: string;
  /**
   * 集合名称
   */
  name: string;
  /**
   * 创建时间
   */
  createdAt: number;
  /**
   * 集合下的层次列表
   */
  levels: Level[];
}

/**
 * 特性类型
 */
export type FeatureType = "numeric" | "single_choice";

/**
 * 特性
 * @description 可以被单元关联的属性
 */
export interface Feature {
  /**
   * 特性唯一标识
   */
  id: string;
  /**
   * 特性名称
   */
  name: string;
  /**
   * 特性类型：数值或单选
   */
  type: FeatureType;
  /**
   * 创建时间
   */
  createdAt: number;
}

/**
 * 完整数据结构
 * @description 包含集合数组和特性
 */
export interface DataStructure {
  /**
   * 集合数组：包含集合元数据和层次
   */
  collections: Collection[];
  /**
   * 特性对象：key为特性ID，value为特性对象
   */
  features: Record<string, Feature>;
}




