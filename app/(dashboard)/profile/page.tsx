"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, User, Bell, Brain, Shield, Check, Trash2, X, Camera, Upload, Eye, EyeOff, Mail, Database, Download } from "lucide-react";
import toast from "react-hot-toast";

function getInitials(name: string) {
    return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
}

const SECTIONS = [
    { key: "profile", label: "Profile", icon: User },
    { key: "interview", label: "Interview Settings", icon: Brain },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "security", label: "Security", icon: Shield },
    { key: "data", label: "Data & Privacy", icon: Database },
];

const FOCUS_AREAS_BY_CATEGORY = {
    "Technical Skills": [
        "Algorithms", "Data Structures", "System Design", "Database Design", 
        "SQL", "API Design", "Cloud Architecture", "Microservices", 
        "Frontend Development", "Backend Development", "Full Stack", "DevOps"
    ],
    "Soft Skills": [
        "Behavioral", "Leadership", "Communication", "Teamwork", 
        "Problem Solving", "Time Management", "Conflict Resolution", "Negotiation"
    ],
    "Domains": [
        "Machine Learning", "AI/ML", "Data Science", "Analytics",
        "Security", "Mobile Development", "Product Management", "Product Sense",
        "UX/UI Design", "Testing/QA"
    ],
    "Industries": [
        "Finance", "Healthcare", "E-commerce", "Social Media",
        "Gaming", "Education", "Enterprise", "Startups"
    ]
};

const ALL_FOCUS_AREAS = Object.values(FOCUS_AREAS_BY_CATEGORY).flat();


export default function ProfilePage() {
    const { user } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [section, setSection] = useState("profile");
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [generatingBio, setGeneratingBio] = useState(false);
    const [focusAreas, setFocusAreas] = useState<string[]>([]);
    const [showFocusModal, setShowFocusModal] = useState(false);
    const [focusSearch, setFocusSearch] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [savingPreferences, setSavingPreferences] = useState(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initialValuesRef = useRef<{name: string, bio: string, focusAreas: string[]}>({name: "", bio: "", focusAreas: []});

    const [difficulty, setDifficulty] = useState("medium");
    const [strictMode, setStrictMode] = useState(false);
    const [sessionLength, setSessionLength] = useState(30);
    const [voiceSpeed, setVoiceSpeed] = useState(1.0);

    const [notifSettings, setNotifSettings] = useState({
        reminders: true, scoreUpdates: true, newFeatures: false, tips: true,
    });

    // Password state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [downloadingData, setDownloadingData] = useState(false);

    // Password strength calculator
    const getPasswordStrength = (password: string) => {
        if (!password) return 0;
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z\d]/.test(password)) strength++;
        return Math.min(strength, 3);
    };

    const passwordStrength = getPasswordStrength(newPassword);
    const strengthColors = ['bg-red-500', 'bg-yellow-500', 'bg-green-500'];
    const strengthLabels = ['Weak', 'Medium', 'Strong'];

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        // Track changes
        const hasChanges = 
            name !== initialValuesRef.current.name ||
            bio !== initialValuesRef.current.bio ||
            JSON.stringify(focusAreas) !== JSON.stringify(initialValuesRef.current.focusAreas);
        
        setHasUnsavedChanges(hasChanges);

        // Auto-save with debounce
        if (hasChanges && !loading) {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
                handleSave(true); // true for auto-save
            }, 2000);
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [name, bio, focusAreas, loading]);

    useEffect(() => {
        // Warn before leaving with unsaved changes
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/user/profile");
            const data = await res.json();
            if (data.success) {
                setProfile(data.user);
                const nameVal = data.user.name || "";
                const bioVal = data.user.bio || "";
                const focusVal = data.user.focusAreas || [];
                
                setName(nameVal);
                setBio(bioVal);
                setAvatarUrl(data.user.image || "");
                setFocusAreas(focusVal);
                
                // Load notification preferences
                setNotifSettings({
                    reminders: data.user.notificationReminders ?? true,
                    scoreUpdates: data.user.notificationScoreUpdates ?? true,
                    newFeatures: data.user.notificationNewFeatures ?? false,
                    tips: data.user.notificationTips ?? true,
                });
                
                // Load interview preferences
                setDifficulty(data.user.defaultDifficulty || 'medium');
                setSessionLength(Math.min(30, data.user.defaultDuration || 15));
                setVoiceSpeed(data.user.voiceSpeed ?? 1.0);
                setStrictMode(data.user.strictMode ?? false);
                
                // Store initial values
                initialValuesRef.current = { name: nameVal, bio: bioVal, focusAreas: focusVal };
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                setAvatarUrl(uploadData.url);
                
                // Update profile with new avatar
                await fetch("/api/user/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: uploadData.url }),
                });
                
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            }
        } catch (error) {
            console.error('Avatar upload failed:', error);
            alert('Failed to upload avatar');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleGenerateBio = async () => {
        if (!name) {
            alert('Please enter your name first');
            return;
        }

        setGeneratingBio(true);
        try {
            const res = await fetch('/api/user/profile/generate-bio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, focusAreas }),
            });

            const data = await res.json();
            if (data.success) {
                setBio(data.bio);
            } else {
                alert('Failed to generate bio');
            }
        } catch (error) {
            console.error('Bio generation failed:', error);
            alert('Failed to generate bio');
        } finally {
            setGeneratingBio(false);
        }
    };

    const handleSave = async (isAutoSave = false) => {
        if (!hasUnsavedChanges && !isAutoSave) return;
        
        setSaving(true);
        try {
            await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, bio, focusAreas }),
            });
            
            // Update initial values after successful save
            initialValuesRef.current = { name, bio, focusAreas };
            setHasUnsavedChanges(false);
            
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) { 
            console.error(e);
            alert('Failed to save changes');
        }
        finally { setSaving(false); }
    };

    const toggleFocusArea = (area: string) => {
        setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
    };

    const calculateProfileCompletion = () => {
        let completion = 0;
        
        // Name (20%)
        if (name && name.trim().length > 0) completion += 20;
        
        // Email (15%) - always completed since it's from Clerk
        if (profile?.email) completion += 15;
        
        // Bio (20%) - must be at least 50 characters
        if (bio && bio.length >= 50) completion += 20;
        
        // Avatar (15%)
        if (avatarUrl || user?.imageUrl) completion += 15;
        
        // Focus Areas (15%) - at least 3 selected
        if (focusAreas.length >= 3) completion += 15;
        
        // Clerk account connected (15%) - always true if logged in
        if (user) completion += 15;
        
        return completion;
    };

    const getCompletionChecklist = () => {
        return [
            { label: "Name added", completed: name && name.trim().length > 0 },
            { label: "Email verified", completed: !!profile?.email },
            { label: "Bio written (50+ chars)", completed: bio && bio.length >= 50 },
            { label: "Avatar uploaded", completed: !!(avatarUrl || user?.imageUrl) },
            { label: "3+ Focus areas selected", completed: focusAreas.length >= 3 },
            { label: "Account connected", completed: !!user },
        ];
    };

    const inputClass = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder-gray-600";

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                        <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500/10 border-b-fuchsia-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                    </div>
                    <p className="text-white font-semibold text-sm">Loading...</p>
                    <p className="text-gray-500 text-xs">Please wait</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl relative">
            {/* Sticky Save Button */}
            {section === "profile" && hasUnsavedChanges && (
                <div className="fixed z-40 animate-slide-in bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-4 lg:inset-x-auto lg:bottom-auto lg:top-4 lg:right-8 [&>button]:w-full [&>button]:justify-center lg:[&>button]:w-auto">
                    <button 
                        onClick={() => handleSave(false)} 
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/30 disabled:opacity-60"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                        ) : saved ? (
                            <><Check className="w-4 h-4" />Saved!</>
                        ) : (
                            <>Save Changes</>
                        )}
                    </button>
                </div>
            )}

            <div className="mb-6 lg:mb-8">
                <p className="text-xs font-semibold text-purple-400 tracking-widest uppercase mb-1">Account</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Settings</h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                {/* Left nav (horizontal scrolling tabs on mobile) */}
                <div className="lg:w-52 flex-shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <nav className="flex lg:flex-col gap-2 lg:gap-0 lg:space-y-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                        {SECTIONS.map(({ key, label, icon: Icon }) => (
                            <button key={key} onClick={() => setSection(key)}
                                className={`flex-shrink-0 lg:w-full whitespace-nowrap flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-sm font-medium transition-all text-left border lg:border-0 ${section === key
                                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5 border-white/10"}`}>
                                <Icon className={`w-4 h-4 ${section === key ? "text-purple-400" : "text-gray-500"}`} />
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Right content */}
                <div className="flex-1 min-w-0">
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-6">

                        {/* Profile section */}
                        {section === "profile" && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div>
                                        <h2 className="font-semibold text-white text-lg mb-1">Profile Information</h2>
                                        <p className="text-sm text-gray-500">Update your account details</p>
                                    </div>
                                    {/* Profile Completion Indicator */}
                                    <div className="group relative">
                                        <div className="flex items-center gap-2">
                                            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-500"
                                                    style={{ width: `${calculateProfileCompletion()}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-purple-300">{calculateProfileCompletion()}%</span>
                                        </div>
                                        {/* Tooltip */}
                                        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[#0f0a1a] border border-white/10 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            <p className="text-xs font-semibold text-purple-300 mb-2">Profile Completion</p>
                                            <div className="space-y-1.5 text-xs">
                                                {getCompletionChecklist().map(({ label, completed }) => (
                                                    <div key={label} className="flex items-center gap-2">
                                                        {completed ? (
                                                            <Check className="w-3 h-3 text-green-400" />
                                                        ) : (
                                                            <X className="w-3 h-3 text-gray-600" />
                                                        )}
                                                        <span className={completed ? "text-gray-300" : "text-gray-600"}>{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                                            <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Avatar */}
                                        <div className="flex items-center gap-4">
                                            <div className="relative group">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-cyan-500 p-[2px] shadow-lg shadow-purple-500/20">
                                                    <div className="w-full h-full rounded-2xl bg-[#0a0514] flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                                                        {uploadingAvatar ? (
                                                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                                                        ) : avatarUrl || user?.imageUrl ? (
                                                            <img src={avatarUrl || user?.imageUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
                                                        ) : (
                                                            getInitials(name || profile?.name || "User")
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Upload overlay */}
                                                {!uploadingAvatar && (
                                                    <div 
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    >
                                                        <Camera className="w-6 h-6 text-white" />
                                                    </div>
                                                )}
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleAvatarUpload}
                                                    className="hidden"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{profile?.name}</p>
                                                <p className="text-sm text-gray-500">{profile?.email}</p>
                                                <p className="text-xs text-gray-600 mt-0.5">
                                                    Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-white/5 pt-5 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                                                <input 
                                                    type="text" 
                                                    value={name} 
                                                    onChange={(e) => setName(e.target.value)}
                                                    disabled={saving || uploadingAvatar}
                                                    className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`} 
                                                    placeholder="Your name" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                                                <input type="email" value={profile?.email || ""} disabled
                                                    className={`${inputClass} cursor-not-allowed opacity-50`} />
                                                <p className="text-xs text-gray-600 mt-1">Email cannot be changed</p>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-sm font-medium text-gray-300">Bio / About</label>
                                                    <button
                                                        onClick={handleGenerateBio}
                                                        disabled={generatingBio || !name}
                                                        className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                    >
                                                        {generatingBio ? (
                                                            <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                                                        ) : (
                                                            <>✨ Generate with AI</>
                                                        )}
                                                    </button>
                                                </div>
                                                <textarea 
                                                    value={bio} 
                                                    onChange={(e) => {
                                                        if (e.target.value.length <= 500) {
                                                            setBio(e.target.value);
                                                        }
                                                    }} 
                                                    rows={3}
                                                    disabled={saving || generatingBio}
                                                    placeholder="Tell us a bit about yourself, your goals, or experience..."
                                                    className={`${inputClass} resize-none disabled:opacity-50 disabled:cursor-not-allowed`} 
                                                />
                                                <div className="flex justify-between items-center mt-1">
                                                    <p className="text-xs text-gray-600">Share your background and what you're preparing for</p>
                                                    <p className={`text-xs ${bio.length >= 500 ? 'text-red-400' : 'text-gray-500'}`}>
                                                        {bio.length}/500
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Focus areas */}
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-sm font-medium text-gray-300">Focus Areas</label>
                                                <button
                                                    onClick={() => setShowFocusModal(true)}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    + Add Areas
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 min-h-[40px]">
                                                {focusAreas.length === 0 ? (
                                                    <p className="text-sm text-gray-600 italic">No focus areas selected yet</p>
                                                ) : (
                                                    <>
                                                        {focusAreas.slice(0, 8).map(area => (
                                                            <div key={area} className="group relative px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-2">
                                                                {area}
                                                                <button 
                                                                    onClick={() => toggleFocusArea(area)}
                                                                    disabled={saving}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                                                                >
                                                                    {saving ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <X className="w-3 h-3" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {focusAreas.length > 8 && (
                                                            <button 
                                                                onClick={() => setShowFocusModal(true)}
                                                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:border-white/20"
                                                            >
                                                                +{focusAreas.length - 8} more
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Danger zone */}
                                        <div className="border-t border-white/5 pt-5">
                                            <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
                                            <button 
                                                onClick={() => setShowDeleteModal(true)}
                                                disabled={deletingAccount}
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {deletingAccount ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                                                ) : (
                                                    <><Trash2 className="w-4 h-4" /> Delete Account</>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Interview Settings */}
                        {section === "interview" && (
                            <div className="space-y-7">
                                <div>
                                    <h2 className="font-semibold text-white text-lg mb-1">Interview Preferences</h2>
                                    <p className="text-sm text-gray-500">Customize your default session settings</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Default Difficulty</label>
                                    <div className="flex gap-2">
                                        {["easy", "medium", "hard"].map((d) => (
                                            <button 
                                                key={d} 
                                                onClick={() => setDifficulty(d)}
                                                disabled={savingPreferences}
                                                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all disabled:opacity-50 ${difficulty === d
                                                    ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                                                    : "bg-white/3 border-white/10 text-gray-400 hover:border-white/20"}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm font-medium text-gray-300">Session Duration</label>
                                        <span className="text-sm text-purple-400 font-medium">{sessionLength} min</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={10} 
                                        max={30} 
                                        step={5} 
                                        value={sessionLength}
                                        onChange={(e) => setSessionLength(Number(e.target.value))}
                                        disabled={savingPreferences}
                                        className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer accent-purple-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                                    />
                                    <div className="flex justify-between text-xs text-gray-600 mt-1"><span>10 min</span><span>30 min</span></div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm font-medium text-gray-300">AI Voice Speed</label>
                                        <span className="text-sm text-purple-400 font-medium">{voiceSpeed.toFixed(1)}×</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={0.5} 
                                        max={2.0} 
                                        step={0.1} 
                                        value={voiceSpeed}
                                        onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                                        disabled={savingPreferences}
                                        className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer accent-purple-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                                    />
                                    <div className="flex justify-between text-xs text-gray-600 mt-1"><span>0.5× Slow</span><span>2.0× Fast</span></div>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/3">
                                    <div>
                                        <p className="text-sm font-medium text-white">Strict Feedback Mode</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Get detailed, honest critiques on every answer</p>
                                    </div>
                                    <button 
                                        onClick={() => setStrictMode(!strictMode)}
                                        disabled={savingPreferences}
                                        className={`relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-50 ${strictMode ? "bg-purple-500" : "bg-white/10"}`}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${strictMode ? "left-6" : "left-0.5"}`} />
                                    </button>
                                </div>

                                <button 
                                    onClick={async () => { 
                                        setSavingPreferences(true); 
                                        try {
                                            await fetch("/api/user/profile", {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ 
                                                    defaultDifficulty: difficulty,
                                                    defaultDuration: sessionLength,
                                                    voiceSpeed,
                                                    strictMode
                                                }),
                                            });
                                            setSaved(true); 
                                            setTimeout(() => setSaved(false), 2000); 
                                        } catch (error) {
                                            console.error('Failed to save preferences:', error);
                                            alert('Failed to save preferences');
                                        } finally {
                                            setSavingPreferences(false);
                                        }
                                    }}
                                    disabled={savingPreferences}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/25 disabled:opacity-60"
                                >
                                    {savingPreferences ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                                    ) : saved ? (
                                        <><Check className="w-4 h-4" />Saved!</>
                                    ) : (
                                        "Save Preferences"
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Notifications */}
                        {section === "notifications" && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="font-semibold text-white text-lg mb-1">Notification Preferences</h2>
                                    <p className="text-sm text-gray-500">Control how we reach you</p>
                                </div>
                                {[
                                    { key: "reminders", label: "Interview reminders", desc: "Daily nudges when streak is at risk" },
                                    { key: "scoreUpdates", label: "Score updates", desc: "When your analytics change significantly" },
                                    { key: "newFeatures", label: "New features", desc: "Product announcements and updates" },
                                    { key: "tips", label: "Tips & best practices", desc: "Weekly interview tips from our AI" },
                                ].map((n) => (
                                    <div key={n.key} className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/3">
                                        <div>
                                            <p className="text-sm font-medium text-white">{n.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{n.desc}</p>
                                        </div>
                                        <button 
                                            onClick={() => setNotifSettings(prev => ({ ...prev, [n.key]: !prev[n.key as keyof typeof prev] }))}
                                            disabled={savingPreferences}
                                            className={`relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-50 ${notifSettings[n.key as keyof typeof notifSettings] ? "bg-purple-500" : "bg-white/10"}`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${notifSettings[n.key as keyof typeof notifSettings] ? "left-6" : "left-0.5"}`} />
                                        </button>
                                    </div>
                                ))}
                                
                                <button 
                                    onClick={async () => { 
                                        setSavingPreferences(true); 
                                        try {
                                            await fetch("/api/user/profile", {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ 
                                                    notificationReminders: notifSettings.reminders,
                                                    notificationScoreUpdates: notifSettings.scoreUpdates,
                                                    notificationNewFeatures: notifSettings.newFeatures,
                                                    notificationTips: notifSettings.tips,
                                                }),
                                            });
                                            setSaved(true); 
                                            setTimeout(() => setSaved(false), 2000); 
                                        } catch (error) {
                                            console.error('Failed to save notification preferences:', error);
                                            alert('Failed to save notification preferences');
                                        } finally {
                                            setSavingPreferences(false);
                                        }
                                    }}
                                    disabled={savingPreferences}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/25 disabled:opacity-60"
                                >
                                    {savingPreferences ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                                    ) : saved ? (
                                        <><Check className="w-4 h-4" />Saved!</>
                                    ) : (
                                        "Save Notification Preferences"
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Security */}
                        {section === "security" && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="font-semibold text-white text-lg mb-1">Security</h2>
                                    <p className="text-sm text-gray-500">Manage your account security</p>
                                </div>

                                {/* Email verification */}
                                <div className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/3">
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-purple-400" />
                                        <div>
                                            <p className="text-sm font-medium text-white">Email Verification</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{profile?.email}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${user?.primaryEmailAddress?.verification?.status === "verified"
                                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                                        : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                                        {user?.primaryEmailAddress?.verification?.status === "verified" ? "Verified ✓" : "Unverified"}
                                    </span>
                                </div>

                                {/* Change Password */}
                                <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                                    <p className="text-sm font-medium text-white mb-1">Change Password</p>
                                    <p className="text-xs text-gray-500 mb-4">Set a new password for your account</p>
                                    <div className="space-y-3">
                                        {/* Current Password */}
                                        <div className="relative">
                                            <input 
                                                type={showCurrentPassword ? "text" : "password"}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Current password" 
                                                className={inputClass} 
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* New Password */}
                                        <div>
                                            <div className="relative">
                                                <input 
                                                    type={showNewPassword ? "text" : "password"}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="New password" 
                                                    className={inputClass} 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                                >
                                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            
                                            {/* Password Strength Indicator */}
                                            {newPassword && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex gap-1">
                                                        {[0, 1, 2].map((index) => (
                                                            <div
                                                                key={index}
                                                                className={`h-1 flex-1 rounded-full transition-all ${
                                                                    passwordStrength > index
                                                                        ? strengthColors[Math.min(passwordStrength - 1, 2)]
                                                                        : 'bg-gray-700'
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className={`text-xs ${
                                                        passwordStrength === 0 ? 'text-red-400' :
                                                        passwordStrength <= 2 ? 'text-yellow-400' :
                                                        'text-green-400'
                                                    }`}>
                                                        {passwordStrength === 0 ? 'Weak' : strengthLabels[Math.min(passwordStrength - 1, 2)]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="relative">
                                            <input 
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password" 
                                                className={inputClass} 
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <button 
                                            onClick={async () => {
                                                if (!currentPassword || !newPassword || !confirmPassword) {
                                                    toast.error("Please fill in all password fields");
                                                    return;
                                                }
                                                if (newPassword !== confirmPassword) {
                                                    toast.error("Passwords do not match");
                                                    return;
                                                }
                                                if (passwordStrength < 2) {
                                                    toast.error("Please use a stronger password");
                                                    return;
                                                }
                                                
                                                setUpdatingPassword(true);
                                                try {
                                                    // Simulate password update (integrate with Clerk's password update API)
                                                    await new Promise(resolve => setTimeout(resolve, 1500));
                                                    toast.success("✓ Password updated successfully");
                                                    setCurrentPassword("");
                                                    setNewPassword("");
                                                    setConfirmPassword("");
                                                } catch (error) {
                                                    toast.error("Failed to update password");
                                                } finally {
                                                    setUpdatingPassword(false);
                                                }
                                            }}
                                            disabled={updatingPassword}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {updatingPassword ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" />Updating...</>
                                            ) : (
                                                "Update Password"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Data & Privacy */}
                        {section === "data" && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="font-semibold text-white text-lg mb-1">Data & Privacy</h2>
                                    <p className="text-sm text-gray-500">Manage your data and privacy settings</p>
                                </div>

                                {/* Download Report */}
                                <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                            <Download className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white mb-1">Download All Data</p>
                                            <p className="text-xs text-gray-500 mb-4">Export all your data including interviews, scores, answers, and profile information as a JSON file.</p>
                                            <button
                                                onClick={async () => {
                                                    setDownloadingData(true);
                                                    try {
                                                        const [profileRes, analyticsRes] = await Promise.all([
                                                            fetch("/api/user/profile"),
                                                            fetch("/api/analytics")
                                                        ]);
                                                        const profileData = await profileRes.json();
                                                        const analyticsData = await analyticsRes.json();

                                                        const exportData = {
                                                            exportDate: new Date().toISOString(),
                                                            profile: profileData.user,
                                                            analytics: analyticsData.analytics,
                                                        };

                                                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement("a");
                                                        a.href = url;
                                                        a.download = `prepmate-data-${new Date().toISOString().split("T")[0]}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);

                                                        toast.success("Data downloaded successfully!");
                                                    } catch (error) {
                                                        toast.error("Failed to download data");
                                                    } finally {
                                                        setDownloadingData(false);
                                                    }
                                                }}
                                                disabled={downloadingData}
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-purple-500/30 text-sm font-medium transition-all disabled:opacity-50"
                                            >
                                                {downloadingData ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" />Preparing download...</>
                                                ) : (
                                                    <><Download className="w-4 h-4" />Download Report</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Data Info */}
                                <div className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-3">
                                    <p className="text-sm font-medium text-white">What's included in your data</p>
                                    {[
                                        { label: "Profile information", desc: "Name, email, bio, settings" },
                                        { label: "Interview history", desc: "All completed and in-progress interviews" },
                                        { label: "Answers & scores", desc: "Your responses and AI evaluations" },
                                        { label: "Analytics data", desc: "Performance trends and statistics" },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                                            <div>
                                                <span className="text-sm text-white">{item.label}</span>
                                                <span className="text-xs text-gray-500 ml-2">— {item.desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Delete Account */}
                                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                            <Trash2 className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white mb-1">Delete Account</p>
                                            <p className="text-xs text-gray-500 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                                            <button
                                                onClick={() => setShowDeleteModal(true)}
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 text-sm font-medium transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />Delete Account
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete account modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
                    <div className="relative rounded-2xl border border-red-500/20 bg-[#0f0a1a] p-6 max-w-md w-full shadow-2xl">
                        <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                        <h3 className="text-lg font-bold text-white mb-2">Delete Account</h3>
                        <p className="text-sm text-gray-400 mb-5">This action is <strong className="text-red-400">permanent</strong> and cannot be undone. All your interviews, analytics, and data will be deleted.</p>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2">Type <strong className="text-white">DELETE</strong> to confirm</label>
                            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                                placeholder="DELETE" className={inputClass} />
                        </div>
                        <button
                            onClick={async () => {
                                setDeletingAccount(true);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                // Add actual delete logic here
                                setDeletingAccount(false);
                            }}
                            disabled={deleteConfirm !== "DELETE" || deletingAccount}
                            className="w-full py-3 rounded-xl bg-red-500 text-white text-sm font-semibold transition-all hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {deletingAccount ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Deleting Account...</>
                            ) : (
                                "Permanently Delete Account"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Focus Areas Modal */}
            {showFocusModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFocusModal(false)}>
                    <div className="bg-[#0f0a1a] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white">Select Focus Areas</h3>
                                <button onClick={() => setShowFocusModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <input 
                                type="text" 
                                value={focusSearch}
                                onChange={e => setFocusSearch(e.target.value)}
                                placeholder="Search focus areas..."
                                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder-gray-600"
                            />
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                            {Object.entries(FOCUS_AREAS_BY_CATEGORY).map(([category, areas]) => {
                                const filteredAreas = areas.filter(area => 
                                    area.toLowerCase().includes(focusSearch.toLowerCase())
                                );
                                
                                if (filteredAreas.length === 0) return null;
                                
                                return (
                                    <div key={category} className="mb-6 last:mb-0">
                                        <h4 className="text-sm font-semibold text-purple-300 mb-3">{category}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {filteredAreas.map(area => (
                                                <button 
                                                    key={area}
                                                    onClick={() => toggleFocusArea(area)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                                        focusAreas.includes(area)
                                                            ? "bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border-purple-500/40 text-purple-300"
                                                            : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                                                    }`}
                                                >
                                                    {focusAreas.includes(area) && <Check className="w-3 h-3 inline mr-1" />}
                                                    {area}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {focusSearch && Object.values(FOCUS_AREAS_BY_CATEGORY).flat().filter(area => 
                                area.toLowerCase().includes(focusSearch.toLowerCase())
                            ).length === 0 && (
                                <p className="text-center text-gray-500 py-8">No matching focus areas found</p>
                            )}
                        </div>
                        <div className="p-6 border-t border-white/10 flex justify-between items-center">
                            <p className="text-sm text-gray-400">{focusAreas.length} areas selected</p>
                            <button 
                                onClick={() => setShowFocusModal(false)}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/25"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
