# User Data DAO Documentation

## 🎯 Overview

The `UserDataDAO` (Data Access Object) is a specialized service that manages user session lifecycle and data isolation in the chat application. It ensures that when users log in/out or switch accounts, their data is properly managed, cached data is cleared, and no data leakage occurs between different user sessions.

## 🏗️ Architecture Pattern

The UserDataDAO implements the **Data Access Object (DAO) pattern** with a focus on:

1. **Session Management**: Handle user login/logout lifecycle
2. **Data Isolation**: Ensure users only see their own data
3. **Cache Management**: Clear stale data when switching users
4. **State Consistency**: Maintain clean application state

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth System   │    │  UserDataDAO    │    │  Data Services  │
│                 │    │                 │    │                 │
│ 1. User Login   │───▶│ 2. Init Session │───▶│ 3. Clear Cache  │
│                 │    │                 │    │                 │
│ 4. User Logout  │───▶│ 5. Terminate    │───▶│ 6. Clear All    │
│                 │    │                 │    │                 │
│ 7. Switch User  │───▶│ 8. Refresh Data │───▶│ 9. Fresh Sync   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Core Components

### 1. Class Structure

```typescript
class UserDataDAO {
  private currentUserId: string | null = null;  // Track active user session
}
```

**Key Design Decisions:**
- **Singleton Pattern**: Single instance manages all user sessions
- **State Tracking**: Maintains current user ID for session management
- **Null Safety**: Handles cases where no user is logged in

### 2. Session Lifecycle Management

The DAO manages three critical lifecycle events:
- **Session Initialization**: When user logs in
- **Session Termination**: When user logs out
- **Session Switching**: When different user logs in

## 📊 Core Methods

### 1. Session Initialization

```typescript
async initializeUserSession(userId: string): Promise<void> {
  // If switching users, clear all data first
  if (this.currentUserId && this.currentUserId !== userId) {
    console.log('Different user detected, clearing previous data');
    await this.clearAllUserData();
  }
  
  // Clear all data for fresh start on login
  await this.clearAllUserData();
  
  // Set current user
  this.currentUserId = userId;
}
```

**Why Clear Data on Every Login?**
- **Security**: Prevents data leakage between users
- **Consistency**: Ensures fresh data from server
- **Performance**: Removes stale cached data
- **Privacy**: No residual data from previous sessions

**Flow:**
1. **User Detection**: Check if different user is logging in
2. **Data Cleanup**: Clear all cached data from IndexedDB
3. **State Update**: Set new current user ID
4. **Fresh Start**: Ready for new user's data

### 2. Session Termination

```typescript
async terminateUserSession(): Promise<void> {
  console.log('Terminating user session for:', this.currentUserId);
  
  // Clear all user data from IndexedDB
  await this.clearAllUserData();
  
  // Reset current user
  this.currentUserId = null;
}
```

**Security-First Approach:**
- **Complete Cleanup**: Remove all traces of user data
- **State Reset**: Clear current user tracking
- **Privacy Protection**: No data persists after logout

### 3. Data Clearing Strategy

```typescript
async clearAllUserData(): Promise<void> {
  console.log('Clearing all user data from IndexedDB');
  
  // Use the sync service to clear cache
  await syncService.clearCache();
  
  // Close and reset IndexedDB connection
  indexedDBService.close();
}
```

**Multi-Layer Cleanup:**
1. **Sync Service**: Clears all cached data via sync service
2. **IndexedDB Reset**: Closes and resets database connection
3. **Memory Cleanup**: Ensures no data remains in memory

## 🔄 Advanced Features

### 1. User Session Switching

```typescript
async refreshUserData(userId: string): Promise<void> {
  console.log('Refreshing user data for:', userId);
  
  // Clear all cached data
  await this.clearAllUserData();
  
  // Update current user
  this.currentUserId = userId;
  
  // Trigger a full sync to reload fresh data
  await syncService.fullSync(userId);
}
```

**Use Case**: When switching between user accounts without full logout/login cycle.

**Process:**
1. **Data Cleanup**: Remove previous user's data
2. **User Switch**: Update current user ID
3. **Fresh Sync**: Load new user's data from server
4. **Ready State**: Application ready with new user's data

### 2. Emergency Cleanup

```typescript
async emergencyCleanup(): Promise<void> {
  console.log('Performing emergency cleanup');
  
  // Clear all data
  await this.clearAllUserData();
  
  // Reset state
  this.currentUserId = null;
  
  // Destroy sync service timeouts
  syncService.destroy();
}
```

**When to Use:**
- Application errors or corruption
- Development/debugging scenarios
- Recovery from inconsistent state
- Memory leak prevention

**Comprehensive Cleanup:**
- All cached data removed
- User state reset
- Background processes stopped
- Clean slate for restart

### 3. Session State Queries

```typescript
getCurrentUserId(): string | null {
  return this.currentUserId;
}

hasActiveSession(): boolean {
  return this.currentUserId !== null;
}
```

**Utility Methods:**
- **State Checking**: Verify if user is logged in
- **User Identification**: Get current user ID
- **Session Validation**: Confirm active session exists

## 🛡️ Security & Privacy Features

### 1. Data Isolation

```typescript
// Prevents data leakage between users
if (this.currentUserId && this.currentUserId !== userId) {
  await this.clearAllUserData();
}
```

**Security Benefits:**
- **User Privacy**: Each user only sees their own data
- **Data Protection**: No cross-user data contamination
- **Compliance**: Meets privacy requirements
- **Trust**: Users can trust their data is isolated

### 2. Complete Data Removal

```typescript
// Multi-layer data clearing
await syncService.clearCache();        // Clear sync service cache
indexedDBService.close();             // Close IndexedDB connection
this.currentUserId = null;            // Reset user state
syncService.destroy();                // Stop background processes
```

**Privacy Protection:**
- **No Residual Data**: Complete removal of user information
- **Memory Safety**: No data remains in browser memory
- **Process Cleanup**: Background sync processes stopped
- **Fresh State**: Clean environment for next user

## 🔧 Integration Patterns

### 1. With Authentication System

```typescript
// In auth provider
const handleLogin = async (user) => {
  await userDataDAO.initializeUserSession(user.id);
  // User can now access their data
};

const handleLogout = async () => {
  await userDataDAO.terminateUserSession();
  // All user data cleared
};
```

### 2. With React Components

```typescript
// In app component
useEffect(() => {
  if (user) {
    userDataDAO.initializeUserSession(user.id);
  } else {
    userDataDAO.terminateUserSession();
  }
}, [user]);
```

### 3. With Data Hooks

```typescript
// In useChatData hook
const { user } = useAuth();

useEffect(() => {
  if (!userDataDAO.hasActiveSession() && user) {
    userDataDAO.initializeUserSession(user.id);
  }
}, [user]);
```

## 📈 Performance Considerations

### 1. Efficient Cleanup

```typescript
// Single operation clears all data types
await syncService.clearCache();  // Clears messages, chats, profiles, sync status
```

**Benefits:**
- **Fast Operation**: Single call clears everything
- **Atomic**: All-or-nothing cleanup
- **Consistent**: No partial cleanup states
- **Reliable**: Guaranteed complete removal

### 2. Lazy Initialization

```typescript
// Only initialize when needed
if (user && !userDataDAO.hasActiveSession()) {
  await userDataDAO.initializeUserSession(user.id);
}
```

**Optimization:**
- **On-Demand**: Only initialize when user logs in
- **State Checking**: Avoid unnecessary operations
- **Resource Efficient**: Minimal overhead when not needed

## 🎯 Design Principles

### 1. **Security First**
- Always clear data between users
- No data persistence after logout
- Complete isolation between sessions

### 2. **Privacy Protection**
- Zero data leakage between users
- Complete cleanup on session end
- No tracking across sessions

### 3. **State Consistency**
- Clean state transitions
- Predictable behavior
- No orphaned data

### 4. **Developer Experience**
- Simple API for session management
- Clear method names and purposes
- Comprehensive error handling

### 5. **Performance Focused**
- Efficient cleanup operations
- Minimal overhead
- Fast state transitions

## 🚀 Usage Examples

### Basic Session Management
```typescript
// User logs in
await userDataDAO.initializeUserSession(user.id);

// Check if session is active
if (userDataDAO.hasActiveSession()) {
  // Load user data
}

// User logs out
await userDataDAO.terminateUserSession();
```

### User Switching
```typescript
// Switch to different user account
await userDataDAO.refreshUserData(newUserId);
```

### Emergency Recovery
```typescript
// Complete cleanup and reset
await userDataDAO.emergencyCleanup();
```

### Session State Checking
```typescript
// Get current user
const currentUser = userDataDAO.getCurrentUserId();

// Check if logged in
const isLoggedIn = userDataDAO.hasActiveSession();
```

## 🔍 Common Use Cases

### 1. **User Login Flow**
```typescript
// Authentication successful
const user = await signIn(email, password);

// Initialize clean session
await userDataDAO.initializeUserSession(user.id);

// Ready to load user's data
```

### 2. **User Logout Flow**
```typescript
// User clicks logout
await signOut();

// Clean up all user data
await userDataDAO.terminateUserSession();

// Redirect to login page
```

### 3. **Account Switching**
```typescript
// User switches to different account
const newUser = await switchAccount(newAccountId);

// Refresh data for new user
await userDataDAO.refreshUserData(newUser.id);

// UI updates with new user's data
```

### 4. **Error Recovery**
```typescript
// Application in inconsistent state
try {
  // Normal operation
} catch (error) {
  // Emergency cleanup
  await userDataDAO.emergencyCleanup();
  
  // Restart session
  if (user) {
    await userDataDAO.initializeUserSession(user.id);
  }
}
```

## 🎯 Key Benefits

### For Users
- **Privacy**: Their data is completely isolated
- **Security**: No data leakage between accounts
- **Performance**: Fresh, clean data on each login
- **Reliability**: Consistent experience across sessions

### For Developers
- **Simple API**: Easy session management
- **Predictable**: Clear state transitions
- **Debuggable**: Comprehensive logging
- **Maintainable**: Clean separation of concerns

### For Application
- **Memory Efficient**: No data accumulation
- **Secure**: Complete data isolation
- **Scalable**: Handles multiple user sessions
- **Robust**: Recovery from error states

The UserDataDAO is a critical component that ensures the chat application maintains proper user session boundaries, protects user privacy, and provides a clean, secure experience for all users. 