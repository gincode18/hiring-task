import { syncService } from './sync-service';
import { indexedDBService } from './indexeddb';

/**
 * User Data Access Object (DAO)
 * Handles user data management including session management and data clearing
 */
class UserDataDAO {
  private currentUserId: string | null = null;

  /**
   * Initialize user session and clear previous user data
   * Called when user logs in
   */
  async initializeUserSession(userId: string): Promise<void> {
    try {
      console.log('UserDataDAO: Initializing user session for:', userId);
      
      // If switching users, clear all data first
      if (this.currentUserId && this.currentUserId !== userId) {
        console.log('UserDataDAO: Different user detected, clearing previous data');
        await this.clearAllUserData();
      }
      
      // Clear all data for fresh start on login
      await this.clearAllUserData();
      
      // Set current user
      this.currentUserId = userId;
      
      console.log('UserDataDAO: User session initialized successfully');
    } catch (error) {
      console.error('UserDataDAO: Error initializing user session:', error);
      throw new Error('Failed to initialize user session');
    }
  }

  /**
   * Clean up user session and clear all data
   * Called when user logs out
   */
  async terminateUserSession(): Promise<void> {
    try {
      console.log('UserDataDAO: Terminating user session for:', this.currentUserId);
      
      // Clear all user data from IndexedDB
      await this.clearAllUserData();
      
      // Reset current user
      this.currentUserId = null;
      
      console.log('UserDataDAO: User session terminated successfully');
    } catch (error) {
      console.error('UserDataDAO: Error terminating user session:', error);
      throw new Error('Failed to terminate user session');
    }
  }

  /**
   * Clear all user data from IndexedDB
   * This includes messages, chats, profiles, and sync status
   */
  async clearAllUserData(): Promise<void> {
    try {
      console.log('UserDataDAO: Clearing all user data from IndexedDB');
      
      // Use the sync service to clear cache (which calls indexedDBService.clearAllData())
      await syncService.clearCache();
      
      // Also close and reset the IndexedDB connection to ensure clean state
      indexedDBService.close();
      
      console.log('UserDataDAO: All user data cleared successfully');
    } catch (error) {
      console.error('UserDataDAO: Error clearing user data:', error);
      throw new Error('Failed to clear user data');
    }
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Check if a user session is active
   */
  hasActiveSession(): boolean {
    return this.currentUserId !== null;
  }

  /**
   * Force refresh user data by clearing cache and triggering fresh sync
   * Useful when switching between different user sessions
   */
  async refreshUserData(userId: string): Promise<void> {
    try {
      console.log('UserDataDAO: Refreshing user data for:', userId);
      
      // Clear all cached data
      await this.clearAllUserData();
      
      // Update current user
      this.currentUserId = userId;
      
      // Trigger a full sync to reload fresh data
      await syncService.fullSync(userId);
      
      console.log('UserDataDAO: User data refreshed successfully');
    } catch (error) {
      console.error('UserDataDAO: Error refreshing user data:', error);
      throw new Error('Failed to refresh user data');
    }
  }

  /**
   * Emergency cleanup - force clear everything
   * Use this as a last resort or for debugging
   */
  async emergencyCleanup(): Promise<void> {
    try {
      console.log('UserDataDAO: Performing emergency cleanup');
      
      // Clear all data
      await this.clearAllUserData();
      
      // Reset state
      this.currentUserId = null;
      
      // Destroy sync service timeouts
      syncService.destroy();
      
      console.log('UserDataDAO: Emergency cleanup completed');
    } catch (error) {
      console.error('UserDataDAO: Error during emergency cleanup:', error);
      throw new Error('Failed to perform emergency cleanup');
    }
  }
}

// Export singleton instance
export const userDataDAO = new UserDataDAO(); 