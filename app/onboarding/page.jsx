'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // URL params from OAuth callback
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const accountId = searchParams.get('accountId');
  const channelId = searchParams.get('channelId');
  const showIdParam = searchParams.get('showId');
  
  // State
  const [step, setStep] = useState(1); // 1: Connect, 2: Select Show, 3: Import, 4: Analyze, 5: Done
  const [isLoading, setIsLoading] = useState(false);
  const [showId, setShowId] = useState(showIdParam || '');
  const [showName, setShowName] = useState('');
  const [youtubeAccountId, setYoutubeAccountId] = useState(accountId || '');
  const [channel, setChannel] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [useEntireChannel, setUseEntireChannel] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [analyzeStatus, setAnalyzeStatus] = useState(null);
  const [onboardingLogs, setOnboardingLogs] = useState([]);
  const [errorMessage, setErrorMessage] = useState(error || '');
  
  // If we have success from OAuth, move to step 2
  useEffect(() => {
    if (success === 'true' && accountId) {
      setYoutubeAccountId(accountId);
      setStep(2);
      fetchPlaylists(accountId);
    }
  }, [success, accountId]);
  
  // Connect YouTube
  const connectYouTube = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const res = await fetch(`/api/youtube/auth?showId=${showId}`);
      const data = await res.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setErrorMessage('Failed to connect to YouTube: ' + err.message);
      setIsLoading(false);
    }
  };
  
  // Fetch playlists
  const fetchPlaylists = async (accId) => {
    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/youtube/playlists?accountId=${accId}`);
      const data = await res.json();
      
      if (data.success) {
        setChannel(data.channel);
        setPlaylists(data.playlists);
      } else {
        setErrorMessage(data.error || 'Failed to fetch playlists');
      }
    } catch (err) {
      setErrorMessage('Failed to fetch playlists: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create show and start import
  const startImport = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setStep(3);
    
    try {
      // Create show if not exists
      let currentShowId = showId;
      
      if (!currentShowId) {
        const createRes = await fetch('/api/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: showName || channel?.title || 'New Show',
            youtube_account_id: youtubeAccountId,
            playlist_id: selectedPlaylist?.id,
            playlist_title: selectedPlaylist?.title
          })
        });
        
        const createData = await createRes.json();
        if (createData.error) throw new Error(createData.error);
        
        currentShowId = createData.show.id;
        setShowId(currentShowId);
      }
      
      // Start import
      setImportStatus({ phase: 'importing', progress: 0 });
      
      const importRes = await fetch('/api/youtube/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: currentShowId,
          accountId: youtubeAccountId,
          playlistId: useEntireChannel ? null : selectedPlaylist?.id,
          maxVideos: 300
        })
      });
      
      const importData = await importRes.json();
      
      if (importData.error) throw new Error(importData.error);
      
      setImportStatus({
        phase: 'completed',
        imported: importData.imported,
        withAnalytics: importData.withAnalytics,
        withTranscripts: importData.withTranscripts
      });
      
      // Move to analyze step
      setStep(4);
      startAnalysis(currentShowId);
      
    } catch (err) {
      setErrorMessage('Import failed: ' + err.message);
      setImportStatus({ phase: 'failed', error: err.message });
      setIsLoading(false);
    }
  };
  
  // Start analysis
  const startAnalysis = async (sId) => {
    setAnalyzeStatus({ phase: 'thumbnails', progress: 0 });
    
    try {
      const res = await fetch('/api/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: sId, step: 'all' })
      });
      
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setAnalyzeStatus({
        phase: 'completed',
        thumbnails: data.thumbnails?.analyzed || 0,
        topics: data.topics?.count || 0,
        classified: data.classified?.count || 0,
        performance: data.performance
      });
      
      setStep(5);
      setIsLoading(false);
      
    } catch (err) {
      setErrorMessage('Analysis failed: ' + err.message);
      setAnalyzeStatus({ phase: 'failed', error: err.message });
      setIsLoading(false);
    }
  };
  
  // Poll for status updates
  useEffect(() => {
    if (step === 3 || step === 4) {
      const interval = setInterval(async () => {
        if (!showId) return;
        
        try {
          const res = await fetch(`/api/onboarding/status?showId=${showId}`);
          const data = await res.json();
          
          if (data.success) {
            setOnboardingLogs(data.logs || []);
            
            if (data.show?.status === 'ready') {
              setStep(5);
              setIsLoading(false);
              clearInterval(interval);
            } else if (data.show?.status === 'failed') {
              setErrorMessage(data.show?.error || 'Onboarding failed');
              setIsLoading(false);
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error('Status poll error:', err);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [step, showId]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">🚀 Add New Show</h1>
          <p className="text-gray-600 mt-2">Connect your YouTube channel and let AI analyze your content</p>
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-12">
          {[
            { num: 1, label: 'Connect' },
            { num: 2, label: 'Select Show' },
            { num: 3, label: 'Import' },
            { num: 4, label: 'Analyze' },
            { num: 5, label: 'Done' }
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                step >= s.num 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`ml-2 font-medium ${step >= s.num ? 'text-blue-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {i < 4 && (
                <div className={`w-12 h-1 mx-4 rounded ${step > s.num ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        
        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ❌ {errorMessage}
          </div>
        )}
        
        {/* Step 1: Connect YouTube */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📺</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your YouTube Channel</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                We'll securely connect to your YouTube account to fetch your videos and analytics data.
              </p>
              
              <div className="mb-6">
                <input
                  type="text"
                  value={showName}
                  onChange={(e) => setShowName(e.target.value)}
                  placeholder="Show name (optional)"
                  className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={connectYouTube}
                disabled={isLoading}
                className="px-8 py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-3 mx-auto"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.8 3.5 12 3.5 12 3.5s-7.8 0-9.5.6c-1 .3-1.7 1.1-2 2.1C0 7.9 0 12 0 12s0 4.1.5 5.8c.3 1 1 1.8 2 2.1 1.7.6 9.5.6 9.5.6s7.8 0 9.5-.6c1-.3 1.7-1.1 2-2.1.5-1.7.5-5.8.5-5.8s0-4.1-.5-5.8zM9.5 15.5v-7l6.4 3.5-6.4 3.5z"/>
                    </svg>
                    Connect with YouTube
                  </>
                )}
              </button>
              
              <p className="mt-6 text-sm text-gray-500">
                🔒 We only request read-only access to your videos and analytics
              </p>
            </div>
          </div>
        )}
        
        {/* Step 2: Select Show/Playlist */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Channel Info */}
            {channel && (
              <div className="flex items-center gap-4 mb-8 p-4 bg-green-50 rounded-xl">
                <img 
                  src={channel.thumbnail} 
                  alt={channel.title}
                  className="w-16 h-16 rounded-full"
                />
                <div>
                  <h3 className="font-bold text-gray-900">{channel.title}</h3>
                  <p className="text-sm text-gray-600">{channel.videoCount} videos</p>
                </div>
                <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  ✓ Connected
                </span>
              </div>
            )}
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select Your Show</h2>
            <p className="text-gray-600 mb-6">
              Choose a playlist to analyze, or use the entire channel
            </p>
            
            {/* Entire Channel Option */}
            <div 
              onClick={() => { setUseEntireChannel(true); setSelectedPlaylist(null); }}
              className={`p-4 border-2 rounded-xl cursor-pointer mb-4 transition-all ${
                useEntireChannel 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  📺
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Entire Channel</h4>
                  <p className="text-sm text-gray-500">Analyze all {channel?.videoCount} videos</p>
                </div>
                {useEntireChannel && (
                  <span className="ml-auto text-blue-600 font-bold">✓</span>
                )}
              </div>
            </div>
            
            {/* Playlists */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-700 mb-3">Or select a playlist:</h4>
              <div className="grid gap-3 max-h-64 overflow-y-auto">
                {playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    onClick={() => { setSelectedPlaylist(playlist); setUseEntireChannel(false); }}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPlaylist?.id === playlist.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {playlist.thumbnail && (
                        <img 
                          src={playlist.thumbnail} 
                          alt={playlist.title}
                          className="w-20 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{playlist.title}</h4>
                        <p className="text-sm text-gray-500">{playlist.videoCount} videos</p>
                      </div>
                      {selectedPlaylist?.id === playlist.id && (
                        <span className="text-blue-600 font-bold">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Show Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Show Name</label>
              <input
                type="text"
                value={showName}
                onChange={(e) => setShowName(e.target.value)}
                placeholder={selectedPlaylist?.title || channel?.title || 'Enter show name'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={startImport}
              disabled={!useEntireChannel && !selectedPlaylist}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Import →
            </button>
          </div>
        )}
        
        {/* Step 3 & 4: Import & Analyze Progress */}
        {(step === 3 || step === 4) && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {step === 3 ? '📥 Importing Videos...' : '🔬 Analyzing Content...'}
            </h2>
            
            {/* Progress Phases */}
            <div className="space-y-4 mb-8">
              {[
                { id: 'videos', label: 'Fetching Videos', icon: '📹' },
                { id: 'analytics', label: 'Fetching Analytics (V7, V30)', icon: '📊' },
                { id: 'transcripts', label: 'Fetching Transcripts & Hooks', icon: '📝' },
                { id: 'thumbnails', label: 'Analyzing Thumbnails (AI Vision)', icon: '🖼️' },
                { id: 'topics', label: 'Generating Topic Categories', icon: '🏷️' },
                { id: 'classify', label: 'Classifying Videos', icon: '🤖' },
                { id: 'performance', label: 'Calculating Performance', icon: '📈' }
              ].map((phase, idx) => {
                const log = onboardingLogs.find(l => l.step?.includes(phase.id));
                const status = log?.status || (idx === 0 && step >= 3 ? 'in_progress' : 'pending');
                
                return (
                  <div key={phase.id} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      status === 'completed' ? 'bg-green-100' :
                      status === 'in_progress' || status === 'started' ? 'bg-blue-100 animate-pulse' :
                      status === 'failed' ? 'bg-red-100' :
                      'bg-gray-100'
                    }`}>
                      {status === 'completed' ? '✓' :
                       status === 'failed' ? '✗' :
                       phase.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        status === 'completed' ? 'text-green-700' :
                        status === 'in_progress' || status === 'started' ? 'text-blue-700' :
                        status === 'failed' ? 'text-red-700' :
                        'text-gray-400'
                      }`}>
                        {phase.label}
                      </p>
                      {log?.message && (
                        <p className="text-sm text-gray-500">{log.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Loading Animation */}
            {isLoading && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                  <span className="animate-spin">⏳</span>
                  <span className="text-blue-700">This may take a few minutes...</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Step 5: Done */}
        {step === 5 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🎉</span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Show Setup Complete!</h2>
            <p className="text-gray-600 mb-8">
              Your channel DNA has been analyzed and is ready to use.
            </p>
            
            {/* Stats Summary */}
            {analyzeStatus?.performance && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-3xl font-bold text-blue-600">{importStatus?.imported || 0}</p>
                  <p className="text-sm text-gray-600">Videos Imported</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-3xl font-bold text-green-600">{analyzeStatus?.performance?.overperforming || 0}</p>
                  <p className="text-sm text-gray-600">Overperforming</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <p className="text-3xl font-bold text-purple-600">{analyzeStatus?.topics || 0}</p>
                  <p className="text-sm text-gray-600">Topics Found</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl">
                  <p className="text-3xl font-bold text-orange-600">{importStatus?.withTranscripts || 0}</p>
                  <p className="text-sm text-gray-600">Hooks Extracted</p>
                </div>
              </div>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push(`/content-tools?showId=${showId}`)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
              >
                🛠️ Go to Content Tools
              </button>
              <button
                onClick={() => router.push(`/signals?showId=${showId}`)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
              >
                📡 View Signals
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}



