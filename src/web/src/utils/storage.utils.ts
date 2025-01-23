/**
 * @fileoverview Secure browser storage utilities with encryption, type safety, and performance optimizations
 * @version 1.0.0
 */

import { AES, enc } from 'crypto-js'; // v4.1.1
import { AuthResponse } from '../types/auth.types';

/**
 * Enum for storage type selection
 */
export enum StorageType {
  LOCAL = 'localStorage',
  SESSION = 'sessionStorage'
}

/**
 * Configuration options for storage operations
 */
export interface StorageOptions {
  encrypt: boolean;
  expiresIn?: number;
  compress?: boolean;
}

// Constants
export const STORAGE_PREFIX = 'codequest_';
export const STORAGE_VERSION = '1.0';
export const MAX_STORAGE_SIZE = 5242880; // 5MB
const STORAGE_ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY;

// In-memory cache for performance optimization
const memoryCache = new Map<string, { value: any; timestamp: number }>();

/**
 * Validates storage availability and quota
 * @param type Storage type to check
 * @throws Error if storage is unavailable or quota is exceeded
 */
const validateStorage = (type: StorageType): void => {
  try {
    const storage = window[type];
    const testKey = `${STORAGE_PREFIX}test`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
  } catch (error) {
    throw new Error(`Storage ${type} is not available: ${error.message}`);
  }
};

/**
 * Generates a storage key with tenant prefix and sanitization
 * @param key Raw storage key
 * @returns Prefixed and sanitized storage key
 */
const generateStorageKey = (key: string): string => {
  const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${STORAGE_PREFIX}${sanitizedKey}`;
};

/**
 * Encrypts data using AES-256
 * @param data Data to encrypt
 * @returns Encrypted data string
 * @throws Error if encryption key is not configured
 */
const encryptData = (data: string): string => {
  if (!STORAGE_ENCRYPTION_KEY) {
    throw new Error('Storage encryption key is not configured');
  }
  return AES.encrypt(data, STORAGE_ENCRYPTION_KEY).toString();
};

/**
 * Decrypts AES-256 encrypted data
 * @param encryptedData Encrypted data string
 * @returns Decrypted data string
 * @throws Error if decryption fails
 */
const decryptData = (encryptedData: string): string => {
  if (!STORAGE_ENCRYPTION_KEY) {
    throw new Error('Storage encryption key is not configured');
  }
  try {
    const bytes = AES.decrypt(encryptedData, STORAGE_ENCRYPTION_KEY);
    return bytes.toString(enc.Utf8);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Securely stores an item in localStorage with optional encryption
 * @param key Storage key
 * @param value Value to store
 * @param options Storage options
 * @returns Promise resolving when storage operation completes
 */
export const setLocalStorageItem = async <T>(
  key: string,
  value: T,
  options: StorageOptions = { encrypt: false }
): Promise<void> => {
  validateStorage(StorageType.LOCAL);

  const storageKey = generateStorageKey(key);
  const storageValue = {
    data: value,
    type: typeof value,
    version: STORAGE_VERSION,
    timestamp: Date.now(),
    expiresAt: options.expiresIn ? Date.now() + options.expiresIn : null
  };

  let serializedValue = JSON.stringify(storageValue);

  if (options.encrypt) {
    serializedValue = encryptData(serializedValue);
  }

  if (serializedValue.length > MAX_STORAGE_SIZE) {
    throw new Error('Storage quota exceeded');
  }

  try {
    localStorage.setItem(storageKey, serializedValue);
    memoryCache.set(storageKey, { value, timestamp: Date.now() });
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
  } catch (error) {
    throw new Error(`Storage operation failed: ${error.message}`);
  }
};

/**
 * Retrieves and optionally decrypts an item from localStorage
 * @param key Storage key
 * @param options Storage options
 * @returns Promise resolving to retrieved value or null
 */
export const getLocalStorageItem = async <T>(
  key: string,
  options: StorageOptions = { encrypt: false }
): Promise<T | null> => {
  validateStorage(StorageType.LOCAL);

  const storageKey = generateStorageKey(key);
  
  // Check memory cache first
  const cachedItem = memoryCache.get(storageKey);
  if (cachedItem && Date.now() - cachedItem.timestamp < 5000) {
    return cachedItem.value as T;
  }

  const rawValue = localStorage.getItem(storageKey);
  if (!rawValue) return null;

  try {
    let parsedValue = options.encrypt ? decryptData(rawValue) : rawValue;
    const storageValue = JSON.parse(parsedValue);

    // Check expiration
    if (storageValue.expiresAt && Date.now() > storageValue.expiresAt) {
      localStorage.removeItem(storageKey);
      memoryCache.delete(storageKey);
      return null;
    }

    // Update cache
    memoryCache.set(storageKey, { value: storageValue.data, timestamp: Date.now() });
    return storageValue.data as T;
  } catch (error) {
    throw new Error(`Failed to retrieve storage item: ${error.message}`);
  }
};

/**
 * Securely stores an item in sessionStorage
 * @param key Storage key
 * @param value Value to store
 * @param options Storage options
 * @returns Promise resolving when storage operation completes
 */
export const setSessionStorageItem = async <T>(
  key: string,
  value: T,
  options: StorageOptions = { encrypt: false }
): Promise<void> => {
  validateStorage(StorageType.SESSION);

  const storageKey = generateStorageKey(key);
  const storageValue = {
    data: value,
    type: typeof value,
    version: STORAGE_VERSION,
    timestamp: Date.now()
  };

  let serializedValue = JSON.stringify(storageValue);

  if (options.encrypt) {
    serializedValue = encryptData(serializedValue);
  }

  if (serializedValue.length > MAX_STORAGE_SIZE) {
    throw new Error('Storage quota exceeded');
  }

  try {
    sessionStorage.setItem(storageKey, serializedValue);
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
  } catch (error) {
    throw new Error(`Session storage operation failed: ${error.message}`);
  }
};

/**
 * Retrieves and optionally decrypts an item from sessionStorage
 * @param key Storage key
 * @param options Storage options
 * @returns Promise resolving to retrieved value or null
 */
export const getSessionStorageItem = async <T>(
  key: string,
  options: StorageOptions = { encrypt: false }
): Promise<T | null> => {
  validateStorage(StorageType.SESSION);

  const storageKey = generateStorageKey(key);
  const rawValue = sessionStorage.getItem(storageKey);
  
  if (!rawValue) return null;

  try {
    let parsedValue = options.encrypt ? decryptData(rawValue) : rawValue;
    const storageValue = JSON.parse(parsedValue);
    return storageValue.data as T;
  } catch (error) {
    throw new Error(`Failed to retrieve session storage item: ${error.message}`);
  }
};

/**
 * Removes an item from specified storage
 * @param key Storage key
 * @param type Storage type
 */
export const removeStorageItem = (key: string, type: StorageType): void => {
  const storageKey = generateStorageKey(key);
  window[type].removeItem(storageKey);
  memoryCache.delete(storageKey);
  window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
};

/**
 * Clears all items from specified storage
 * @param type Storage type
 */
export const clearStorage = (type: StorageType): void => {
  window[type].clear();
  if (type === StorageType.LOCAL) {
    memoryCache.clear();
  }
  window.dispatchEvent(new StorageEvent('storage'));
};

/**
 * Checks if an item exists in specified storage
 * @param key Storage key
 * @param type Storage type
 * @returns Boolean indicating if item exists
 */
export const hasStorageItem = (key: string, type: StorageType): boolean => {
  const storageKey = generateStorageKey(key);
  return window[type].getItem(storageKey) !== null;
};