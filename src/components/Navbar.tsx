import React, { useState } from 'react';
import { 
  ShieldAlert, 
  BookOpen, 
  UserCheck, 
  FileText, 
  Upload, 
  Edit3, 
  Settings, 
  Maximize2, 
  RefreshCw, 
  RotateCcw,
  Activity,
  Menu,
  X,
  UserCog,
  ChevronDown,
  LogOut,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  activeView: 'student' | 'admin';
  adminTab: 'dashboard' | 'grading' | 'upload' | 'preview' | 'gas_setup' | 'custom_practice';
  setActiveView: (view: 'student' | 'admin') => void;
  setAdminTab: (tab: 'dashboard' | 'grading' | 'upload' | 'preview' | 'gas_setup' | 'custom_practice') => void;
  isLoggedIn?: boolean;
  studentMode?: 'TEST' | 'PRACTICE';
  sbd?: string;
  examCode?: string;
  gasUrl: string;
  onOpenDiagnostics?: () => void;
  onTriggerReload?: () => void;
  onTriggerExit?: () => void;
  isFocusFlowMode?: boolean;
  onToggleFocusFlowMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  adminTab,
  setActiveView,
  setAdminTab,
  isLoggedIn = false,
  studentMode,
  sbd,
  examCode,
  gasUrl,
  onOpenDiagnostics,
  onTriggerReload,
  onTriggerExit,
  isFocusFlowMode = false,
  onToggleFocusFlowMode
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Cannot enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const adminTabsConfig = [
    { id: 'dashboard', label: 'Monitoring & Logs', icon: ShieldAlert, shortLabel: 'Monitoring' },
    { id: 'grading', label: 'Grade Writing', icon: Edit3, shortLabel: 'Grading' },
    { id: 'upload', label: 'AI Exam Generator', icon: Upload, shortLabel: 'AI Generator' },
    { id: 'custom_practice', label: 'Practice Sets', icon: BookOpen, shortLabel: 'Practice Sets' },
    { id: 'preview', label: 'Exam Preview & Builder', icon: FileText, shortLabel: 'Exam Builder' },
    { id: 'gas_setup', label: 'GAS Config', icon: Settings, shortLabel: 'GAS Backend' }
  ] as const;

  const currentTabObj = adminTabsConfig.find(t => t.id === adminTab) || adminTabsConfig[0];
  const CurrentTabIcon = currentTabObj.icon;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-purple-100/80 text-[#3C2A63] sticky top-0 z-40 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Left: Brand Title & Mobile Menu Trigger */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {activeView === 'admin' && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6B51A5] border border-purple-200 transition cursor-pointer"
                aria-label="Toggle Admin Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <div className="select-none cursor-default">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-[#3C2A63] cursor-default">
                  EO EO Testing
                </h1>
                {activeView === 'admin' && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-purple-100 text-[#6B51A5] border border-purple-200 shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-[#7C68A5] hidden xs:block truncate max-w-[150px] sm:max-w-none">
                {activeView === 'student' ? 'Student Exam Interface' : 'Teacher & Admin Management'}
              </p>
            </div>
          </div>

          {/* Center Info Badges for Student (Desktop/Tablet) - Shown ONLY when candidate is actively logged in */}
          {activeView === 'student' && isLoggedIn && sbd && examCode && (
            <div className="hidden md:flex items-center space-x-3 bg-[#F5F2F9] px-4 py-1.5 rounded-2xl border border-purple-100 text-xs">
              <span className="font-medium text-[#503A7A]">
                Candidate ID: <strong className="text-[#3C2A63] font-bold">{sbd}</strong>
              </span>
              <span className="text-purple-200">|</span>
              <span className="font-medium text-[#503A7A]">
                Exam Code: <strong className="text-[#6B51A5] font-bold">{examCode}</strong>
              </span>
              <span className="text-purple-200">|</span>
              <span className={`px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                studentMode === 'TEST'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}>
                {studentMode === 'TEST' ? '🔒 EXAM MODE' : '📖 PRACTICE MODE'}
              </span>
            </div>
          )}

          {/* Admin Desktop Sub-Tabs */}
          {activeView === 'admin' && (
            <div className="hidden lg:flex items-center space-x-1 bg-[#E2DDEC] p-1.5 rounded-2xl">
              {adminTabsConfig.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = adminTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setAdminTab(tab.id as any);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isActive ? 'bg-[#6B51A5] text-white shadow-md' : 'text-[#3C2A63] hover:text-[#503A7A]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}

              {onOpenDiagnostics && (
                <button
                  onClick={onOpenDiagnostics}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 whitespace-nowrap"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  <span>DB Diagnostics</span>
                </button>
              )}
            </div>
          )}

          {/* Right Controls: View Switcher & Fullscreen */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            
            {/* When in Admin mode: Return to Student view */}
            {activeView === 'admin' && (
              <button
                onClick={() => {
                  setActiveView('student');
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-1.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm bg-purple-100 text-[#503A7A] border border-purple-300/80 hover:bg-purple-200"
                title="Return to Student View"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Student View</span>
                <span className="sm:hidden">Student</span>
              </button>
            )}

            {/* When in Student mode actively taking test: Focus Mode toggle & Safe Exit */}
            {activeView === 'student' && isLoggedIn && (
              <>
                {onToggleFocusFlowMode && (
                  <button
                    type="button"
                    onClick={onToggleFocusFlowMode}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isFocusFlowMode
                        ? 'bg-purple-900 text-purple-100 border-purple-700 shadow-inner'
                        : 'bg-[#E2DDEC] hover:bg-[#D9D3E4] text-[#3C2A63] border-purple-200'
                    }`}
                    title={isFocusFlowMode ? 'Thoát chế độ tập trung (Exit Flow Mode)' : 'Chế độ tập trung (Flow Mode: Giảm thiểu xao nhãng)'}
                    aria-label="Chế độ tập trung"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isFocusFlowMode ? 'text-amber-400 animate-pulse' : 'text-purple-600'}`} />
                    <span className="hidden sm:inline">{isFocusFlowMode ? 'Flow: BẬT' : 'Tập trung'}</span>
                  </button>
                )}

                {onTriggerExit && (
                  <button
                    type="button"
                    onClick={onTriggerExit}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200"
                    title="Rời khỏi bài thi (Bảo vệ tiến trình & Xác nhận an toàn)"
                    aria-label="Rời bài thi"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Rời bài thi</span>
                  </button>
                )}
              </>
            )}

            {onTriggerReload && (
              <button
                type="button"
                onClick={onTriggerReload}
                className="p-2 rounded-xl bg-[#E2DDEC] hover:bg-[#D9D3E4] text-[#3C2A63] transition-all cursor-pointer"
                title="Tải lại trang (Reload Page)"
                aria-label="Tải lại trang"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-[#E2DDEC] hover:bg-[#D9D3E4] text-[#3C2A63] transition-all cursor-pointer"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Student Mobile Compact Badge Bar - Shown ONLY when candidate is actively logged in */}
        {activeView === 'student' && isLoggedIn && sbd && examCode && (
          <div className="md:hidden py-1.5 border-t border-purple-100/60 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 text-[#503A7A] font-semibold truncate">
              <span>ID: <strong className="text-[#3C2A63]">{sbd}</strong></span>
              <span className="text-purple-200">|</span>
              <span>Code: <strong className="text-[#6B51A5]">{examCode}</strong></span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
              studentMode === 'TEST'
                ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {studentMode === 'TEST' ? '🔒 TEST' : '📖 PRACTICE'}
            </span>
          </div>
        )}
      </div>

      {/* Admin Mobile Horizontal Scroll Tab Bar (< lg) */}
      {activeView === 'admin' && (
        <div className="lg:hidden border-t border-purple-100/80 bg-[#F8F6FC] px-2 py-2 overflow-x-auto scrollbar-none flex items-center gap-1.5 shadow-inner">
          {adminTabsConfig.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setAdminTab(tab.id as any);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#6B51A5] text-white shadow-sm'
                    : 'bg-white text-[#503A7A] border border-purple-100 hover:bg-purple-50'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}

          {onOpenDiagnostics && (
            <button
              onClick={() => {
                onOpenDiagnostics();
                setMobileMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap shrink-0"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>DB Stats</span>
            </button>
          )}
        </div>
      )}

      {/* Admin Mobile Menu Dropdown Drawer */}
      {activeView === 'admin' && mobileMenuOpen && (
        <div className="lg:hidden border-t border-purple-100 bg-white p-4 shadow-xl space-y-2 animate-in slide-in-from-top duration-200">
          <div className="text-xs font-black uppercase text-[#7C68A5] px-1 pb-1">
            Admin Management Sections:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {adminTabsConfig.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = adminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setAdminTab(tab.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl text-xs font-bold text-left flex items-center gap-3 transition cursor-pointer ${
                    isActive
                      ? 'bg-[#6B51A5] text-white shadow-md'
                      : 'bg-[#F8F6FC] text-[#3C2A63] hover:bg-purple-50 border border-purple-100'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${isActive ? 'bg-white/20 text-white' : 'bg-purple-100 text-[#6B51A5]'}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold">{tab.label}</div>
                    <div className={`text-[11px] font-normal ${isActive ? 'text-purple-100' : 'text-[#7C68A5]'}`}>
                      {tab.id === 'dashboard' && 'View submissions & anti-cheat alerts'}
                      {tab.id === 'grading' && 'Evaluate Task 1 & 2 student essays'}
                      {tab.id === 'upload' && 'Upload PDF & parse with Gemini API'}
                      {tab.id === 'custom_practice' && 'Manage flashcards & questions'}
                      {tab.id === 'preview' && 'Visual Exam Builder & test preview'}
                      {tab.id === 'gas_setup' && 'View GAS backend code & endpoints'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {onOpenDiagnostics && (
            <button
              onClick={() => {
                onOpenDiagnostics();
                setMobileMenuOpen(false);
              }}
              className="w-full p-3 rounded-2xl text-xs font-bold text-left flex items-center gap-3 bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer mt-2"
            >
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
              </div>
              <div>
                <div className="font-extrabold">System &amp; Database Diagnostics</div>
                <div className="text-[11px] text-indigo-600 font-normal">Check IndexedDB local sync &amp; Google Sheets connectivity</div>
              </div>
            </button>
          )}
        </div>
      )}
    </header>
  );
};

