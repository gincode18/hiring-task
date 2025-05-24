"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AiOutlineDatabase, AiOutlineDelete, AiOutlineSync, AiOutlineWifi, AiOutlineReload, AiOutlineWarning } from "react-icons/ai";
import { useStorageInfo, useOfflineSync } from "@/hooks/use-chat-data";
import { syncService } from "@/lib/sync-service";
import { userDataDAO } from "@/lib/user-data-dao";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";

export function StorageManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { storageInfo, loading, refresh } = useStorageInfo();
  const { isOnline, pendingSync } = useOfflineSync();
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEmergencyClearing, setIsEmergencyClearing] = useState(false);

  const handleClearCache = async () => {
    if (!user?.id) return;

    setIsClearing(true);
    try {
      await syncService.clearCache();
      await refresh();
      toast({
        title: "Cache cleared",
        description: "All locally stored data has been removed",
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear cache",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleUserDataRefresh = async () => {
    if (!user?.id) return;

    setIsClearing(true);
    try {
      await userDataDAO.refreshUserData(user.id);
      await refresh();
      toast({
        title: "User data refreshed",
        description: "All data cleared and fresh data loaded from server",
      });
    } catch (error) {
      console.error("Error refreshing user data:", error);
      toast({
        title: "Error",
        description: "Failed to refresh user data",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleEmergencyCleanup = async () => {
    setIsEmergencyClearing(true);
    try {
      await userDataDAO.emergencyCleanup();
      await refresh();
      toast({
        title: "Emergency cleanup completed",
        description: "All data and connections have been reset",
      });
    } catch (error) {
      console.error("Error during emergency cleanup:", error);
      toast({
        title: "Error",
        description: "Failed to complete emergency cleanup",
        variant: "destructive",
      });
    } finally {
      setIsEmergencyClearing(false);
    }
  };

  const handleForceSync = async () => {
    if (!user?.id) return;

    setIsSyncing(true);
    try {
      const results = await syncService.fullSync(user.id);
      await refresh();
      
      const totalSynced = results.messages.synced + results.chats.synced + results.profiles.synced;
      
      toast({
        title: "Sync completed",
        description: `Synced ${totalSynced} items from server`,
      });
    } catch (error) {
      console.error("Error syncing:", error);
      toast({
        title: "Error",
        description: "Failed to sync data",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <AiOutlineDatabase className="h-4 w-4" />
          Storage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AiOutlineDatabase className="h-5 w-5" />
            Local Storage Manager
          </DialogTitle>
          <DialogDescription>
            Manage your locally cached chat data and sync status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Session Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AiOutlineDatabase className="h-4 w-4" />
                User Session
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={userDataDAO.hasActiveSession() ? "default" : "secondary"}>
                    {userDataDAO.hasActiveSession() ? "Active" : "Inactive"}
                  </Badge>
                  {user && (
                    <span className="text-sm text-gray-600 truncate max-w-[200px]">
                      {user.email}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  ID: {userDataDAO.getCurrentUserId()?.slice(-8) || "None"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Connection Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AiOutlineWifi className="h-4 w-4" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Badge variant={isOnline ? "default" : "secondary"} className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-400" : "bg-gray-400"}`} />
                  {isOnline ? "Online" : "Offline"}
                </Badge>
                {pendingSync && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <AiOutlineSync className="h-3 w-3 animate-spin" />
                    Pending Sync
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Storage Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Storage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : storageInfo ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {storageInfo.storage.messagesCount}
                    </div>
                    <div className="text-xs text-gray-500">Messages</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {storageInfo.storage.chatsCount}
                    </div>
                    <div className="text-xs text-gray-500">Chats</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {storageInfo.storage.profilesCount}
                    </div>
                    <div className="text-xs text-gray-500">Profiles</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {storageInfo.storage.estimatedSize}
                    </div>
                    <div className="text-xs text-gray-500">Size</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No data available</div>
              )}
            </CardContent>
          </Card>

          {/* Sync Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Last Sync Times</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Messages:</span>
                <span className="font-mono text-xs">
                  {formatDate(storageInfo?.messages?.lastSyncAt)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Chats:</span>
                <span className="font-mono text-xs">
                  {formatDate(storageInfo?.chats?.lastSyncAt)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Profiles:</span>
                <span className="font-mono text-xs">
                  {formatDate(storageInfo?.profiles?.lastSyncAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            {/* Primary Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleForceSync}
                disabled={isSyncing || !isOnline}
                className="flex-1"
                variant="outline"
              >
                {isSyncing ? (
                  <>
                    <AiOutlineSync className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <AiOutlineReload className="h-4 w-4 mr-2" />
                    Force Sync
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleClearCache}
                disabled={isClearing}
                variant="outline"
                className="flex-1"
              >
                {isClearing ? (
                  <>
                    <AiOutlineSync className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <AiOutlineDelete className="h-4 w-4 mr-2" />
                    Clear Cache
                  </>
                )}
              </Button>
            </div>

            {/* Advanced Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleUserDataRefresh}
                disabled={isClearing || !user?.id}
                variant="secondary"
                className="flex-1"
              >
                {isClearing ? (
                  <>
                    <AiOutlineSync className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <AiOutlineReload className="h-4 w-4 mr-2" />
                    Fresh Reload
                  </>
                )}
              </Button>

              <Button
                onClick={handleEmergencyCleanup}
                disabled={isEmergencyClearing}
                variant="destructive"
                className="flex-1"
              >
                {isEmergencyClearing ? (
                  <>
                    <AiOutlineSync className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <AiOutlineWarning className="h-4 w-4 mr-2" />
                    Emergency Reset
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg space-y-2">
            <p className="font-medium mb-1">About IndexedDB Storage:</p>
            <p>
              Messages and chats are stored locally in your browser for faster loading and offline access. 
              Data automatically syncs when you're online, and automatically clears on login/logout.
            </p>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="font-medium text-orange-600">Action Descriptions:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li><strong>Force Sync:</strong> Re-download all data from server</li>
                <li><strong>Clear Cache:</strong> Remove cached data (keeps sync)</li>
                <li><strong>Fresh Reload:</strong> Clear all data and reload fresh</li>
                <li><strong>Emergency Reset:</strong> Force cleanup everything (for issues)</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 