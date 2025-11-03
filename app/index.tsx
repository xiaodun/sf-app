import { StyleSheet, Modal, TextInput, TouchableOpacity, Alert, View } from 'react-native';
import { useState } from 'react';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [collectionName, setCollectionName] = useState('');

  const handleCreateCollection = () => {
    if (collectionName.trim()) {
      Alert.alert('成功', `集合 "${collectionName}" 已创建`);
      setCollectionName('');
      setModalVisible(false);
    } else {
      Alert.alert('错误', '请输入集合名称');
    }
  };

  return (
    <>
    <View style={styles.container}>
      <View style={styles.content}>
        {/* 主要内容区域 */}
      </View>
      
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.createButton} onPress={() => setModalVisible(true)}>
          <ThemedText style={styles.createButtonText}>创建集合</ThemedText>
        </TouchableOpacity>
      </View>
    </View>

    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <ThemedView style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          <ThemedText type="subtitle" style={styles.modalTitle}>创建新集合</ThemedText>
          
          <TextInput
            style={styles.textInput}
            placeholder="请输入集合名称"
            value={collectionName}
            onChangeText={setCollectionName}
            autoFocus={true}
          />
          
          <ThemedView style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => {
                setModalVisible(false);
                setCollectionName('');
              }}
            >
              <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.confirmButton]} 
              onPress={handleCreateCollection}
            >
              <ThemedText style={styles.confirmButtonText}>创建</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#000000',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
