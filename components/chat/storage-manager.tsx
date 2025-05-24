"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AiOutlineDatabase, AiOutlineDelete, AiOutlineSync, AiOutlineWifi, AiOutlineReload } from "react-icons/ai";
import { useStorageInfo, useOfflineSync } from "@/hooks/use-chat-data";
import { syncService } from "@/lib/sync-service";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";

export function StorageManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { storageInfo, loading, refresh } = useStorageInfo();
  const { isOnline, pendingSync } = useOfflineSync();
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
              variant="destructive"
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

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">About IndexedDB Storage:</p>
            <p>
              Messages and chats are stored locally in your browser for faster loading and offline access. 
              Data automatically syncs when you're online, and you can work offline with cached data.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 