'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminCentral } from '@/utils/infra/admin-central';
import type { AdminUser, RoomStats, UserStats, Report, SystemHealth, ModerationAction } from '@/utils/infra/admin-central';
import {
    Shield, LogOut, Lock, LayoutDashboard, DoorOpen, Users, AlertTriangle,
    Hammer, ScrollText, Activity, ChevronDown, ChevronRight, Trash2,
    Ban, AlertCircle, CheckCircle, XCircle, RefreshCw, Crown, Zap,
    Smartphone, Monitor, Tablet, Wifi, Signal, Globe, Clock, MessageSquare,
    History, Bell, Eye, EyeOff, Database, Smile, BarChart2
} from 'lucide-react';
import { telemetry, type TelemetryEvent } from '@/utils/core/telemetry';

interface AdminPanelProps {
    children?: React.ReactNode;
}

export function AdminPanelLogin({ children }: AdminPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [clicks, setClicks] = useState(0);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [admin, setAdmin] = useState<AdminUser | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'rooms' | 'users' | 'reports' | 'moderation' | 'logs' | 'telemetry'>('dashboard');
    const [filterRoomId, setFilterRoomId] = useState<string | null>(null);

    // Authenticate with Admin Central
    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        try {
            setError(''); // Clear previous errors
            const user = await adminCentral.login(email, password);
            if (user) {
                setAdmin(user);
                setIsLoggedIn(true);
                // Request notification permission on successful login
                if ("Notification" in window) {
                    Notification.requestPermission();
                }
            } else {
                setError('Authentication failed. You are not authorized.');
            }
        } catch (e: any) {
            console.error('Admin Central: Login error', e);
            if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                setError('Invalid email or password');
            } else if (e.code === 'auth/too-many-requests') {
                setError('Too many failed attempts. Please try again later.');
            } else if (e.code === 'auth/admin-restricted-operation') {
                setError('Email/Password auth is restricted or disabled in Firebase Console.');
            } else {
                setError('System error during authentication');
            }
        }
    };

    useEffect(() => {
        if (clicks === 0) return;
        const timer = setTimeout(() => setClicks(0), 3000);
        return () => clearTimeout(timer);
    }, [clicks]);

    const handleClick = () => {
        const newClicks = clicks + 1;
        setClicks(newClicks);

        if (newClicks >= 7) {
            setIsOpen(true);
            setClicks(0);
        }
    };

    const handleAuthSubmit = () => {
        handleLogin();
    };

    const handleLogout = async () => {
        await adminCentral.logout();
        setIsLoggedIn(false);
        setAdmin(null);
        setEmail('');
        setPassword('');
        setError('');
        setIsOpen(false);
    };

    return (
        <>
            <div onClick={handleClick} style={{ cursor: 'pointer' }}>
                {children}
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden border-0 bg-transparent p-0 shadow-none">
                    {/* Premium Glassmorphism Container */}
                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl shadow-2xl">
                        {/* Animated background orbs */}
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />

                        <div className="relative">
                            {!isLoggedIn ? (
                                <div className="p-10 space-y-8">
                                    {/* Premium Header */}
                                    <div className="flex flex-col items-center space-y-6">
                                        <div className="relative group">
                                            {/* Glow effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 blur-2xl opacity-50 animate-pulse group-hover:opacity-75 transition-opacity" />
                                            {/* Logo container */}
                                            <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 p-1">
                                                <div className="flex items-center justify-center w-full h-full rounded-xl bg-slate-950 overflow-hidden">
                                                    <img src="/satloom/admin-logo.png" alt="Admin Central" className="w-16 h-16 object-contain" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center space-y-3">
                                            <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                                                Admin Central
                                            </h2>
                                            <p className="text-slate-400 text-lg flex items-center justify-center gap-2">
                                                <Lock className="w-4 h-4" />
                                                Secure authentication required
                                            </p>
                                        </div>
                                    </div>

                                    {/* Premium Input Section */}
                                    <div className="space-y-6 max-w-sm mx-auto">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300 ml-1">Admin Email</label>
                                                <Input
                                                    type="email"
                                                    placeholder="admin@satloom.app"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="bg-slate-900/80 border-slate-700 text-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                                                <Input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                                    className="bg-slate-900/80 border-slate-700 text-white"
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="relative overflow-hidden rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                                                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent" />
                                                <div className="relative flex items-center gap-2 text-red-400">
                                                    <AlertCircle className="w-5 h-5" />
                                                    <span className="font-medium">{error}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Premium Buttons */}
                                        <div className="space-y-4 pt-4">
                                            <Button
                                                onClick={handleAuthSubmit}
                                                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all border-0"
                                            >
                                                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/20 to-pink-400/20 opacity-0 hover:opacity-100 transition-opacity" />
                                                <Shield className="w-5 h-5 mr-2" />
                                                Authenticate
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    setClicks(0);
                                                    setEmail('');
                                                    setPassword('');
                                                    setError('');
                                                }}
                                                className="w-full h-12 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <AdminDashboard
                                    admin={admin}
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    onLogout={handleLogout}
                                    filterRoomId={filterRoomId}
                                    setFilterRoomId={setFilterRoomId}
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

interface AdminDashboardProps {
    admin: AdminUser | null;
    activeTab: string;
    onTabChange: (tab: 'dashboard' | 'rooms' | 'users' | 'reports' | 'moderation' | 'logs' | 'telemetry') => void;
    onLogout: () => void;
    filterRoomId: string | null;
    setFilterRoomId: (id: string | null) => void;
}

function AdminDashboard({ admin, activeTab, onTabChange, onLogout, filterRoomId, setFilterRoomId }: AdminDashboardProps) {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [rooms, setRooms] = useState<RoomStats[]>([]);
    const [users, setUsers] = useState<UserStats[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [moderation, setModeration] = useState<ModerationAction[]>([]);
    const [history, setHistory] = useState<TelemetryEvent[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    useEffect(() => {
        setRooms(adminCentral.getRooms());
        setUsers(adminCentral.getUsers());
        setReports(adminCentral.getReports());
        setModeration(adminCentral.getModerationActions());
        setHealth(adminCentral.getSystemHealth());

        const unsubRoom = adminCentral.subscribe('room-update', (updatedRooms: any) => {
            setRooms(adminCentral.getRooms());

            // Notification logic for milestones
            const currentRooms = adminCentral.getRooms();
            const matchedRoom = currentRooms.find(r => r.participantCount === 2);
            if (matchedRoom) {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Milestone Reached", {
                        body: `Room ${matchedRoom.roomName} now has 2 members!`,
                        icon: '/admin-logo.png'
                    });
                    // Play audio chime if you have an assets directory
                    const audio = new Audio('/satloom/notification.mp3');
                    audio.play().catch(() => { });
                }
            }
        });

        const unsubNewRoom = adminCentral.subscribe('room-created', (room: any) => {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("New Group Created", {
                    body: `A new group "${room.roomName || room.roomId}" has been formed.`,
                    icon: '/admin-logo.png'
                });
            }
        });

        const unsubUser = adminCentral.subscribe('user-update', () => setUsers(adminCentral.getUsers()));
        const unsubReport = adminCentral.subscribe('report-created', () => setReports(adminCentral.getReports()));

        return () => {
            unsubRoom();
            unsubNewRoom();
            unsubUser();
            unsubReport();
        };
    }, []);

    // Fetch telemetry history when tab changes
    useEffect(() => {
        if (activeTab === 'telemetry') {
            setIsLoadingLogs(true);
            adminCentral.getTelemetryHistory().then(h => {
                setHistory(h);
                setIsLoadingLogs(false);
            });
        }
    }, [activeTab]);

    const analytics = adminCentral.getAnalyticsSummary();

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'rooms', label: 'Rooms', icon: DoorOpen },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'telemetry', label: 'Usage Analytics', icon: Activity },
        { id: 'reports', label: 'Reports', icon: AlertTriangle },
        { id: 'moderation', label: 'Moderation', icon: Hammer },
        { id: 'logs', label: 'System Logs', icon: ScrollText },
    ];

    return (
        <div className="max-h-[85vh] overflow-hidden flex flex-col">
            {/* Premium Glassmorphism Header */}
            <div className="relative border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-purple-500/10" />
                {/* Animated glow */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                <div className="relative p-6 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                            <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 p-1">
                                <div className="flex items-center justify-center w-full h-full rounded-lg bg-slate-950">
                                    <Crown className="w-8 h-8 text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-100 to-purple-100 bg-clip-text text-transparent">
                                Admin Central
                            </h1>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                Welcome back, {admin?.email}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLogout}
                        className="text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all border border-slate-700/50 hover:border-slate-600"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </div>

            {/* Premium Tab Bar */}
            <div className="relative border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5" />
                <div className="relative flex gap-1 p-2 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id as any)}
                                className={`relative flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all ${isActive
                                    ? 'text-white bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 shadow-lg shadow-purple-500/10'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                    }`}
                            >
                                {isActive && (
                                    <>
                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 animate-pulse" />
                                        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-500" />
                                    </>
                                )}
                                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : ''}`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <PremiumStatCard title="Total Rooms" value={analytics.totalRooms} icon={DoorOpen} color="cyan" />
                        <PremiumStatCard title="Active Rooms" value={analytics.activeRooms} icon={Activity} color="green" trend="up" />
                        <PremiumStatCard title="Total Users" value={analytics.totalUsers} icon={Users} color="purple" />
                        <PremiumStatCard title="Pending Reports" value={analytics.pendingReports} icon={AlertTriangle} color="orange" />
                        <PremiumStatCard title="Active Users" value={analytics.activeUsers} icon={Zap} color="green" trend="up" />
                        <PremiumStatCard title="Total Messages" value={analytics.totalMessages} icon={MessageSquare} color="blue" />
                        <PremiumStatCard title="Bans Today" value={analytics.bansToday} icon={Ban} color="red" />
                        <PremiumStatCard
                            title="System Health"
                            value={health ? `${Math.round(health.cpuUsage)}%` : '...'}
                            subtitle="CPU Usage"
                            icon={Activity}
                            color="green"
                        />
                    </div>
                )}

                {activeTab === 'rooms' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            <DoorOpen className="w-5 h-5 text-cyan-400" />
                            Room Management
                        </h3>
                        {rooms.length === 0 ? (
                            <EmptyState icon={DoorOpen} message="No rooms found" />
                        ) : (
                            <div className="grid gap-3">
                                {rooms.map((room) => (
                                    <PremiumRoomCard key={room.roomId} room={room} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-purple-400" />
                            User Management
                        </h3>
                        {users.length === 0 ? (
                            <EmptyState icon={Users} message="No users found" />
                        ) : (
                            <div className="grid gap-3">
                                {users.map((user) => (
                                    <PremiumUserCard key={user.userId} user={user} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-400" />
                            Reports
                        </h3>
                        {reports.length === 0 ? (
                            <EmptyState icon={CheckCircle} message="No reports - all clear!" />
                        ) : (
                            <div className="grid gap-3">
                                {reports.map((report) => (
                                    <PremiumReportCard key={report.id} report={report} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'moderation' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            <Hammer className="w-5 h-5 text-red-400" />
                            Moderation History
                        </h3>
                        {moderation.length === 0 ? (
                            <EmptyState icon={Hammer} message="No moderation actions" />
                        ) : (
                            <div className="grid gap-3">
                                {moderation.slice(-10).reverse().map((action) => (
                                    <PremiumModerationCard key={action.id} action={action} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'telemetry' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                                        <Activity className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    Universal Tracking Feed
                                    {filterRoomId && (
                                        <span className="text-sm font-normal px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                            Room: {filterRoomId}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {filterRoomId ? `Showing all activities for room ${filterRoomId}` : 'Real-time monitoring of all global activities'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {filterRoomId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFilterRoomId(null)}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Clear Filter
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        if (window.confirm("Clear all telemetry logs? This cannot be undone.")) {
                                            await adminCentral.clearTelemetry();
                                            setHistory([]);
                                        }
                                    }}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all font-medium"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear History
                                </Button>
                            </div>
                        </div>

                        {isLoadingLogs ? (
                            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-cyan-500 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 animate-pulse" />
                                    </div>
                                </div>
                                <p className="text-slate-400 font-medium animate-pulse">Syncing activities...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <EmptyState icon={History} message="No activity recorded yet" />
                        ) : (
                            <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                {history
                                    .filter(event => !filterRoomId || event.roomId === filterRoomId)
                                    .map((event, idx) => (
                                        <PremiumActivityItem
                                            key={event.id || idx}
                                            event={event}
                                            onInspect={() => setFilterRoomId(event.roomId)}
                                        />
                                    ))
                                }
                                {filterRoomId && history.filter(event => event.roomId === filterRoomId).length === 0 && (
                                    <EmptyState icon={EyeOff} message={`No activity found for room ${filterRoomId}`} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Premium Components
function PremiumStatCard({ title, value, subtitle, icon: Icon, color, trend }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    color: 'cyan' | 'purple' | 'green' | 'orange' | 'red' | 'blue';
    trend?: 'up' | 'down';
}) {
    const colorClasses = {
        cyan: 'from-cyan-500 to-blue-500',
        purple: 'from-purple-500 to-pink-500',
        green: 'from-green-500 to-emerald-500',
        orange: 'from-orange-500 to-red-500',
        red: 'from-red-500 to-pink-500',
        blue: 'from-blue-500 to-cyan-500',
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/10">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity" style={{
                backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
            }} />
            {/* Corner glow */}
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full blur-2xl group-hover:bg-gradient-to-br group-hover:from-cyan-500/30 group-hover:to-purple-500/30 transition-all" />

            <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                    <div className="relative">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} p-0.5`}>
                            <div className="flex items-center justify-center w-full h-full rounded-lg bg-slate-950">
                                <Icon className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                    {trend && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trend === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} border border-white/10`}>
                            {trend === 'up' ? <TrendingUpIcon className="w-3 h-3" /> : <TrendingDownIcon className="w-3 h-3" />}
                            {trend === 'up' ? '+' : '-'}
                        </div>
                    )}
                </div>
                <div>
                    <div className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">{value}</div>
                    <div className="text-sm text-slate-400 font-medium">{title}</div>
                    {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
                </div>
            </div>
        </div>
    );
}

function PremiumActivityItem({ event, onInspect }: { event: TelemetryEvent; onInspect?: () => void }) {
    const getEventConfig = () => {
        const type = event.type;
        if (type === 'message_sent') return { icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10' };
        if (type === 'emoji_sent') return { icon: Smile, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
        if (type === 'file_shared') return { icon: Database, color: 'text-green-400', bg: 'bg-green-500/10' };
        if (type === 'poll_created') return { icon: BarChart2, color: 'text-purple-400', bg: 'bg-purple-500/10' };
        if (type === 'link_shared') return { icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
        if (type.includes('theater')) return { icon: Eye, color: 'text-pink-400', bg: 'bg-pink-500/10' };
        if (type.includes('game')) return { icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10' };
        if (type.includes('call')) return { icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
        if (type === 'room_created') return { icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/20' };
        return { icon: History, color: 'text-slate-400', bg: 'bg-slate-500/10' };
    };

    const config = getEventConfig();
    const Icon = config.icon;

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md p-4 transition-all hover:bg-slate-800/60 hover:border-white/10">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${config.bg} border border-white/5 shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white truncate">{event.userName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 border border-white/5">
                                {event.roomId}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-2">
                            <span className={`font-medium ${config.color}`}>{event.type.replace('_', ' ')}</span>
                            {event.details && (
                                <span className="truncate opacity-60">
                                    • {Object.entries(event.details).map(([k, v]) => `${v}`).join(', ')}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-slate-300">
                        {event.timestamp ? new Date(event.timestamp as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                        <Globe className="w-3 h-3" />
                        {event.location?.city || 'Unknown'}
                    </div>
                </div>
            </div>

            {/* Context bar on hover */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {event.device?.browser}</span>
                    <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> {event.device?.os}</span>
                </div>
                <div
                    className="text-[10px] text-cyan-500 font-medium cursor-pointer hover:underline"
                    onClick={() => onInspect?.()}
                >
                    Inspect Room Details
                </div>
            </div>
        </div>
    );
}

// Trending icons for stat cards
function TrendingUpIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
    );
}

function TrendingDownIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
    );
}

function PremiumRoomCard({ room }: { room: RoomStats }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 transition-all hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10">
            {/* Animated glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />

            <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${room.isActive ? 'from-cyan-500 to-blue-500' : 'from-slate-700 to-slate-800'} p-0.5`}>
                            <div className="flex items-center justify-center w-full h-full rounded-lg bg-slate-950">
                                <DoorOpen className={`w-7 h-7 ${room.isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                            </div>
                        </div>
                        {room.isActive && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse" />
                        )}
                    </div>
                    <div>
                        <p className="font-semibold text-white text-lg">{room.roomName}</p>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" />
                            {room.participantCount} participants
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {room.isActive ? (
                        <span className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            Active
                        </span>
                    ) : (
                        <span className="px-4 py-2 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            Closed
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                            if (window.confirm(`Are you absolutely sure you want to PERMANENTLY delete room "${room.roomName}"? This will also wipe all its telemetry and active calls.`)) {
                                await adminCentral.deleteRoom(room.roomId);
                            }
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PremiumUserCard({ user }: { user: UserStats }) {
    const [expanded, setExpanded] = useState(false);

    const getDeviceIcon = () => {
        if (!user.deviceInfo) return Monitor;
        switch (user.deviceInfo.deviceType) {
            case 'mobile': return Smartphone;
            case 'tablet': return Tablet;
            default: return Monitor;
        }
    };

    const DeviceIcon = getDeviceIcon();

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl transition-all hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/10">
            {/* Animated gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />

            <div
                className="relative p-5 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 p-0.5">
                                <div className="flex items-center justify-center w-full h-full rounded-lg bg-slate-950 text-white font-bold text-xl">
                                    {user.displayName.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            {user.isBanned && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
                                    <Ban className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="font-semibold text-white text-lg flex items-center gap-2">
                                {user.displayName}
                                {user.isBanned && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                        Banned
                                    </span>
                                )}
                            </p>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                                <DeviceIcon className="w-4 h-4" />
                                {user.deviceInfo?.deviceType || 'Unknown'} • {user.deviceInfo?.os || 'Unknown OS'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="relative border-t border-white/10 bg-slate-950/50 p-5 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoSection title="ACTIVITY">
                            <InfoItem label="Messages" value={user.totalMessages} />
                            <InfoItem label="Rooms" value={user.roomCount} />
                            <InfoItem label="Joined" value={new Date(user.joinTime).toLocaleDateString()} />
                        </InfoSection>

                        <InfoSection title="DEVICE">
                            <InfoItem label="OS" value={user.deviceInfo?.os || 'N/A'} />
                            <InfoItem label="Browser" value={user.deviceInfo?.browser || 'N/A'} />
                            <InfoItem label="Screen" value={user.deviceInfo?.screenResolution || 'N/A'} />
                        </InfoSection>

                        <InfoSection title="CONNECTION">
                            <InfoItem label="Type" value={user.connectionInfo?.type || 'N/A'} icon={Wifi} />
                            <InfoItem label="Speed" value={user.connectionInfo?.effectiveType || 'N/A'} icon={Signal} />
                            <InfoItem label="Downlink" value={user.connectionInfo?.downlink ? `${user.connectionInfo.downlink} Mbps` : 'N/A'} />
                        </InfoSection>

                        <InfoSection title="LOCATION">
                            <InfoItem label="Country" value={user.locationInfo?.country || 'N/A'} icon={Globe} />
                            <InfoItem label="City" value={user.locationInfo?.city || 'N/A'} />
                            <InfoItem label="Timezone" value={user.locationInfo?.timezone || 'N/A'} />
                        </InfoSection>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-white/10">
                        <Button
                            size="sm"
                            onClick={async () => {
                                if (user.isBanned) {
                                    await adminCentral.unbanUser(user.userId);
                                } else {
                                    const reason = window.prompt('Enter ban reason:', 'Banned by admin');
                                    if (reason) await adminCentral.banUser(user.userId, reason);
                                }
                            }}
                            className={`h-10 px-4 ${user.isBanned ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white shadow-lg transition-all hover:scale-[1.02]`}
                        >
                            {user.isBanned ? <CheckCircle className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                            {user.isBanned ? 'Unban' : 'Ban'}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                                const reason = window.prompt('Enter warning:', 'Warning from admin');
                                if (reason) await adminCentral.warnUser(user.userId, reason);
                            }}
                            className="h-10 px-4 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                        >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Warn
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => adminCentral.updateUserDeviceInfo(user.userId)}
                            className="h-10 px-4 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function PremiumReportCard({ report }: { report: Report }) {
    const statusColors = {
        pending: 'from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30',
        reviewed: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
        resolved: 'from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30',
        dismissed: 'from-slate-500/20 to-slate-600/20 text-slate-400 border-slate-500/30',
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 transition-all hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/10">
            {/* Animated gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all" />

            <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-white capitalize flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                        {report.type}
                    </span>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase border bg-gradient-to-r ${statusColors[report.status]}`}>
                        {report.status}
                    </span>
                </div>
                {report.message && (
                    <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3 border border-white/5">
                        {report.message}
                    </p>
                )}
                <div className="flex gap-3">
                    <Button
                        size="sm"
                        onClick={async () => await adminCentral.reviewReport(report.id, 'resolved')}
                        className="h-10 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg transition-all hover:scale-[1.02]"
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Resolve
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => await adminCentral.reviewReport(report.id, 'dismissed')}
                        className="h-10 px-4 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                    >
                        <XCircle className="w-4 h-4 mr-2" />
                        Dismiss
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PremiumModerationCard({ action }: { action: ModerationAction }) {
    const typeColors = {
        ban: 'from-red-500/20 to-pink-500/20 text-red-400 border-red-500/30',
        mute: 'from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30',
        kick: 'from-orange-500/20 to-red-500/20 text-orange-400 border-orange-500/30',
        warn: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 transition-all hover:border-red-500/30 hover:shadow-xl hover:shadow-red-500/10">
            {/* Animated gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all" />

            <div className="relative space-y-3">
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase border bg-gradient-to-r ${typeColors[action.type]}`}>
                        {action.type}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(action.timestamp).toLocaleString()}
                    </span>
                </div>
                <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3 border border-white/5">
                    {action.reason}
                </p>
            </div>
        </div>
    );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function InfoItem({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1">
                {Icon && <Icon className="w-3 h-3" />}
                {label}:
            </span>
            <span className="text-slate-200 font-medium">{value}</span>
        </div>
    );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 mb-4">
                <Icon className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-500">{message}</p>
        </div>
    );
}

export default AdminPanelLogin;
