import React, { useState, useEffect } from 'react';
import { X, Palette, Image as ImageIcon, Save, Type, Maximize, Settings as SettingsIcon, MonitorPlay, ShieldAlert, Check, User, Upload, Edit2, FolderOpen, Trash2 } from 'lucide-react';
import type { Profile } from './ProfilesScreen';

export interface Settings {
  accentColor: string;
  wallpaperPath: string;
  overlayOpacity: number;
  appName: string;
  uiScale: number;
  useExternalPlayer: boolean;
  externalPlayerPath: string;
  movieFolders: string[];
  tvFolders: string[];
  skipProfilePicker: boolean;
  defaultProfileId: string | null;
}

const RECENT_COLORS = ['#003e8f', '#bc13fe', '#cf3f4c', '#555555', '#7b4cff'];

const AVATAR_OPTIONS = Array.from({ length: 9 }, (_, i) => `./avatars/key${i + 1}.jpg`);

export function SettingsModal({ onClose, onSave, currentSettings, activeProfileId: _activeProfileId, initialTab = 'general' }: { 
  onClose: () => void, 
  onSave: (settings: Settings) => void,
  currentSettings: Settings,
  activeProfileId?: string | null,
  initialTab?: 'general' | 'library' | 'personalization' | 'profiles' | 'advanced'
}) {
  const [settings, setSettings] = useState<Settings>({
    ...currentSettings,
    movieFolders: currentSettings.movieFolders ?? [],
    tvFolders: currentSettings.tvFolders ?? [],
    skipProfilePicker: currentSettings.skipProfilePicker ?? false,
    defaultProfileId: currentSettings.defaultProfileId ?? null,
  });
  const [activeTab, setActiveTab] = useState<'general' | 'library' | 'personalization' | 'profiles' | 'advanced'>(initialTab);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showAvatarGrid, setShowAvatarGrid] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('netflix_profiles');
    if (saved) setProfiles(JSON.parse(saved));
  }, []);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0] as any;
      if (file.path) {
        setSettings({ ...settings, wallpaperPath: file.path });
      }
    }
  };

  const addFolders = async (type: 'movie' | 'tv') => {
    if (!window.electronAPI?.selectFolders) return;
    const selected = await window.electronAPI.selectFolders();
    if (!selected.length) return;
    const key = type === 'movie' ? 'movieFolders' : 'tvFolders';
    const existing = settings[key];
    const merged = [...existing];
    for (const folder of selected) {
      if (!merged.includes(folder)) merged.push(folder);
    }
    setSettings({ ...settings, [key]: merged });
  };

  const removeFolder = (type: 'movie' | 'tv', folder: string) => {
    const key = type === 'movie' ? 'movieFolders' : 'tvFolders';
    setSettings({ ...settings, [key]: settings[key].filter(f => f !== folder) });
  };

  const handleCustomAvatarUpload = async () => {
    if (!editingProfile || !window.electronAPI?.cacheProfileImage) return;
    const cachedPath = await window.electronAPI.cacheProfileImage();
    if (!cachedPath) return;
    const updated = { ...editingProfile, avatar: cachedPath };
    setEditingProfile(updated);
    const newProfiles = profiles.map(p => p.id === updated.id ? updated : p);
    setProfiles(newProfiles);
    localStorage.setItem('netflix_profiles', JSON.stringify(newProfiles));
    setShowAvatarGrid(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#181818] w-full max-w-2xl rounded-xl shadow-2xl border border-gray-800 flex overflow-hidden min-h-[500px]">
        {/* Sidebar Tabs */}
        <div className="w-1/3 bg-[#111] p-6 border-r border-gray-800 flex flex-col gap-2">
          <h2 className="text-xl font-bold mb-6 text-white px-2">Settings</h2>
          
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === 'general' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
          >
            <SettingsIcon className="w-5 h-5" /> General
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === 'library' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
          >
            <FolderOpen className="w-5 h-5" /> Library
          </button>
          <button 
            onClick={() => setActiveTab('personalization')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === 'personalization' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
          >
            <Palette className="w-5 h-5" /> Personalization
          </button>
          <button 
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === 'profiles' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
          >
            <User className="w-5 h-5" /> Profiles
          </button>
          <button 
            onClick={() => setActiveTab('advanced')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === 'advanced' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
          >
            <ShieldAlert className="w-5 h-5" /> Advanced
          </button>
        </div>

        {/* Content Area */}
        <div className="w-2/3 p-8 relative overflow-y-auto max-h-[80vh]">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>

          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-bold text-white mb-6">General Settings</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Type className="w-4 h-4" /> App Title
                </label>
                <input 
                  type="text" 
                  value={settings.appName}
                  onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                  className="bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none w-full focus:border-accent transition"
                  placeholder="e.g., JOHNFLIX"
                />
                <p className="text-xs text-gray-500 mt-2">Replaces the Netflix logo in the top corner.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Maximize className="w-4 h-4" /> UI Scale: {Math.round(settings.uiScale * 100)}%
                </label>
                <input 
                  type="range" 
                  min="0.5" max="1.5" step="0.05"
                  value={settings.uiScale}
                  onChange={(e) => setSettings({ ...settings, uiScale: parseFloat(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-bold text-white mb-6">Library Folders</h3>
              <p className="text-sm text-gray-400 -mt-4 mb-6">
                Add one or more folders for movies and TV shows. Each section scans its own folders independently.
              </p>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Movie Folders</label>
                <div className="space-y-2 mb-3">
                  {settings.movieFolders.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No movie folders selected.</p>
                  ) : settings.movieFolders.map(folder => (
                    <div key={folder} className="flex items-center gap-2 bg-black/50 border border-gray-700 rounded-lg px-3 py-2">
                      <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300 truncate flex-grow" title={folder}>{folder}</span>
                      <button onClick={() => removeFolder('movie', folder)} className="text-gray-500 hover:text-red-400 transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addFolders('movie')}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white text-sm font-semibold transition"
                >
                  <FolderOpen className="w-4 h-4" /> Add Movie Folder(s)
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">TV Show Folders</label>
                <div className="space-y-2 mb-3">
                  {settings.tvFolders.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No TV show folders selected.</p>
                  ) : settings.tvFolders.map(folder => (
                    <div key={folder} className="flex items-center gap-2 bg-black/50 border border-gray-700 rounded-lg px-3 py-2">
                      <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300 truncate flex-grow" title={folder}>{folder}</span>
                      <button onClick={() => removeFolder('tv', folder)} className="text-gray-500 hover:text-red-400 transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addFolders('tv')}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white text-sm font-semibold transition"
                >
                  <FolderOpen className="w-4 h-4" /> Add TV Folder(s)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'personalization' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-bold text-white mb-6">Personalization</h3>

              {/* Accent Color Section matching the user's screenshot */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Accent Color</label>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-12 h-12 rounded overflow-hidden border-2 border-gray-600 focus-within:border-white transition shadow-lg bg-black">
                    <input 
                      type="color" 
                      value={settings.accentColor}
                      onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                      className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                    />
                  </div>
                  <span className="text-gray-300 text-sm font-mono tracking-wider">{settings.accentColor}</span>
                </div>
                
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Recent colors</label>
                  <div className="flex gap-2">
                    {RECENT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings({ ...settings, accentColor: color })}
                        className={`w-10 h-10 rounded border-2 transition relative ${settings.accentColor.toLowerCase() === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      >
                        {settings.accentColor.toLowerCase() === color && (
                          <div className="absolute -top-1 -right-1 bg-black rounded-full border border-gray-600 p-0.5">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Custom Wallpaper</label>
                <div className="flex items-center gap-3 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 relative hover:border-gray-500 transition cursor-pointer group">
                  <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-sm text-gray-300 truncate w-full">
                    {settings.wallpaperPath ? settings.wallpaperPath.split('\\').pop() : 'Click to browse...'}
                  </span>
                </div>
                {settings.wallpaperPath && (
                  <button 
                    onClick={() => setSettings({ ...settings, wallpaperPath: '' })}
                    className="text-xs text-red-500 mt-2 hover:underline font-semibold"
                  >
                    Remove Wallpaper
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Background Darkness: {Math.round(settings.overlayOpacity * 100)}%
                </label>
                <input 
                  type="range" 
                  min="0" max="1" step="0.1"
                  value={settings.overlayOpacity}
                  onChange={(e) => setSettings({ ...settings, overlayOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-bold text-white mb-2">Profiles</h3>

              {!editingProfile && (
                <div
                  className="flex items-center gap-3 mb-4 bg-gray-800/30 p-4 rounded-lg border border-gray-800 cursor-pointer hover:bg-gray-800/50 transition"
                  onClick={() => {
                    const next = !settings.skipProfilePicker;
                    let defaultProfileId = settings.defaultProfileId;
                    if (next && !defaultProfileId && profiles.length > 0) {
                      defaultProfileId = profiles[0].id;
                    }
                    setSettings({ ...settings, skipProfilePicker: next, defaultProfileId });
                  }}
                >
                  <User className="w-5 h-5 text-accent flex-shrink-0" />
                  <div className="flex-grow min-w-0">
                    <span className="text-sm font-bold text-white block">Skip profile selection on startup</span>
                    <span className="text-xs text-gray-400">Sign in with your default profile automatically</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.skipProfilePicker}
                    onChange={(e) => {
                      const next = e.target.checked;
                      let defaultProfileId = settings.defaultProfileId;
                      if (next && !defaultProfileId && profiles.length > 0) {
                        defaultProfileId = profiles[0].id;
                      }
                      setSettings({ ...settings, skipProfilePicker: next, defaultProfileId });
                    }}
                    className="w-5 h-5 accent-accent flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              
              {editingProfile && showAvatarGrid ? (
                // Avatar grid picker
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-4">Choose Avatar for {editingProfile.name}</h4>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {AVATAR_OPTIONS.map((avatar, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const updated = { ...editingProfile, avatar };
                          setEditingProfile(updated);
                          const newProfiles = profiles.map(p => p.id === updated.id ? updated : p);
                          setProfiles(newProfiles);
                          localStorage.setItem('netflix_profiles', JSON.stringify(newProfiles));
                          setShowAvatarGrid(false);
                        }}
                        className={`w-full aspect-square rounded-lg overflow-hidden border-4 transition-all duration-200 hover:scale-105 ${editingProfile.avatar === avatar ? 'border-white' : 'border-transparent hover:border-gray-500'}`}
                      >
                        <img src={avatar} alt={`Avatar ${i + 1}`} className='w-full h-full object-cover' />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleCustomAvatarUpload}
                    className='inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white text-sm font-semibold transition'
                  >
                    <Upload className='w-4 h-4' /> Upload Custom
                  </button>
                  <button onClick={() => setShowAvatarGrid(false)} className="ml-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
                </div>
              ) : editingProfile ? (
                // Edit profile inline
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setShowAvatarGrid(true)} className="w-20 h-20 rounded-lg overflow-hidden border-2 border-transparent hover:border-white transition-all group relative flex-shrink-0">
                      <img src={editingProfile.avatar} className="w-full h-full object-cover" />
                      <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                        <Edit2 className='w-5 h-5 text-white' />
                      </div>
                    </button>
                    <div className="flex-grow space-y-2">
                      <input 
                        type="text" value={editingProfile.name}
                        onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                        className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none w-full focus:border-white transition"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Color</span>
                        <input type="color" value={editingProfile.color} onChange={e => setEditingProfile({ ...editingProfile, color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const exists = profiles.find(p => p.id === editingProfile.id);
                      let newProfiles;
                      if (exists) {
                        newProfiles = profiles.map(p => p.id === editingProfile.id ? editingProfile : p);
                      } else {
                        newProfiles = [...profiles, editingProfile];
                      }
                      setProfiles(newProfiles);
                      localStorage.setItem('netflix_profiles', JSON.stringify(newProfiles));
                      setEditingProfile(null);
                    }} className="bg-white text-black px-4 py-1.5 rounded text-sm font-bold hover:bg-gray-200 transition">Save</button>
                    <button onClick={() => setEditingProfile(null)} className="text-gray-400 text-sm hover:text-white transition px-4 py-1.5 border border-gray-600 rounded">Cancel</button>
                    {profiles.find(p => p.id === editingProfile.id) && profiles.length > 1 && (
                      <button onClick={() => {
                        const newProfiles = profiles.filter(p => p.id !== editingProfile.id);
                        setProfiles(newProfiles);
                        localStorage.setItem('netflix_profiles', JSON.stringify(newProfiles));
                        if (settings.defaultProfileId === editingProfile.id) {
                          setSettings({
                            ...settings,
                            defaultProfileId: newProfiles[0]?.id ?? null,
                            skipProfilePicker: newProfiles.length > 0 && settings.skipProfilePicker,
                          });
                        }
                        setEditingProfile(null);
                      }} className="ml-auto text-red-500 text-sm hover:text-white hover:bg-red-500 transition px-4 py-1.5 border border-red-500 rounded font-bold">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Profile list
                <div className="space-y-3">
                  {settings.skipProfilePicker && (
                    <p className="text-xs text-gray-500 mb-1">Default profile:</p>
                  )}
                  {profiles.map(p => (
                    <div key={p.id} className={`flex items-center gap-4 p-3 rounded-lg border transition group ${settings.defaultProfileId === p.id && settings.skipProfilePicker ? 'bg-gray-800/60 border-accent/40' : 'bg-gray-800/30 border-gray-800 hover:bg-gray-800/50'}`}>
                      <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 border-2 border-transparent group-hover:border-gray-600 transition" style={{ backgroundColor: p.color }}>
                        <img src={p.avatar} className="w-full h-full object-cover" alt="" />
                      </div>
                      <span className="text-white font-semibold flex-grow truncate">{p.name}</span>
                      {settings.skipProfilePicker && (
                        <button
                          onClick={() => setSettings({ ...settings, defaultProfileId: p.id })}
                          className={`text-xs font-bold px-3 py-1 rounded transition flex-shrink-0 ${settings.defaultProfileId === p.id ? 'bg-accent text-white' : 'bg-gray-700/50 text-gray-400 hover:text-white'}`}
                        >
                          {settings.defaultProfileId === p.id ? 'Default' : 'Set default'}
                        </button>
                      )}
                      <button onClick={() => setEditingProfile(p)} className="text-gray-400 hover:text-white text-sm font-semibold transition bg-gray-700/50 px-3 py-1 rounded flex-shrink-0">Edit</button>
                    </div>
                  ))}
                  
                  <button onClick={() => {
                    setEditingProfile({
                      id: Date.now().toString(),
                      name: 'New Profile',
                      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
                      avatar: `./avatars/key${Math.floor(Math.random() * 9) + 1}.jpg`
                    });
                  }} className="w-full flex items-center justify-center gap-2 bg-gray-800/30 hover:bg-gray-800/80 p-3 rounded-lg border border-gray-700 border-dashed text-gray-400 hover:text-white transition font-semibold">
                    + Add New Profile
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-bold text-white mb-6">Advanced Settings</h3>

              <div>
                <div className="flex items-center gap-3 mb-4 bg-gray-800/30 p-4 rounded-lg border border-gray-800 cursor-pointer hover:bg-gray-800/50 transition"
                     onClick={() => setSettings({ ...settings, useExternalPlayer: !settings.useExternalPlayer })}>
                  <MonitorPlay className="w-5 h-5 text-accent" />
                  <div className="flex-grow">
                    <label className="text-sm font-bold text-white block cursor-pointer">
                      Use External Video Player
                    </label>
                    <span className="text-xs text-gray-400">Launch VLC or PotPlayer instead of internal player</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={settings.useExternalPlayer}
                    onChange={(e) => setSettings({ ...settings, useExternalPlayer: e.target.checked })}
                    className="w-5 h-5 accent-accent"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {settings.useExternalPlayer && (
                  <div className="ml-2 pl-4 border-l-2 border-gray-700 space-y-2 animate-in slide-in-from-top-2">
                    <label className="block text-xs font-semibold text-gray-400">Path to Player Executable (.exe)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={settings.externalPlayerPath}
                        onChange={(e) => setSettings({ ...settings, externalPlayerPath: e.target.value })}
                        className="bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white outline-none flex-grow focus:border-accent transition"
                        placeholder="C:\Program Files\DAUM\PotPlayer\PotPlayer64.exe"
                      />
                      <button 
                        onClick={async () => {
                          const path = await window.electronAPI.selectFile();
                          if (path) setSettings({ ...settings, externalPlayerPath: path });
                        }}
                        className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white text-sm font-bold transition shadow"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-8 mt-8 border-t border-gray-800">
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to completely reset all settings and library data? The app will reload.")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="text-red-500 text-sm hover:underline font-semibold"
                >
                  Reset All App Data
                </button>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-12 flex justify-end">
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-accent text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Save className="w-5 h-5" />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
