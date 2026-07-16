import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Loader2 } from 'lucide-react';

interface AudioPlayerProps {
  fileUrl: string;
  fileName: string;
  onEnded: () => void;
}

export default function AudioPlayer({ fileUrl, fileName, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Reset state on URL change
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [fileUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Play error:", e));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setIsLoading(false);
    // Auto-play on load
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(e => console.log("Auto-play prevented or failed", e));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTime = Number(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const vol = Number(e.target.value);
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    audioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 28,
      padding: '40px 36px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 28,
      border: '1px solid rgba(255,255,255,0.08)',
      minWidth: 420,
      maxWidth: '92%',
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(20px)',
      position: 'relative'
    }}>
      {/* Hidden native audio tag */}
      <audio
        ref={audioRef}
        src={fileUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
      />

      {/* album disc cover art */}
      <div style={{
        width: 140, height: 140, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(11,87,208,0.2) 0%, rgba(11,87,208,0.05) 100%)',
        border: '3px solid rgba(11,87,208,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(11,87,208,0.15)',
        position: 'relative',
        animation: isPlaying ? 'spin 12s linear infinite' : 'none',
        transition: 'transform 0.5s ease'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#121212', border: '2px solid rgba(255,255,255,0.08)',
          position: 'absolute', zIndex: 2
        }} />
        {isLoading ? (
          <Loader2 className="animate-spin" size={40} color="#a8c7fa" />
        ) : (
          <Music size={48} color="#a8c7fa" style={{ opacity: 0.8 }} />
        )}
      </div>

      {/* Info labels */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <p style={{
          color: 'rgba(255,255,255,0.92)',
          fontSize: 16,
          fontWeight: 600,
          fontFamily: 'Google Sans,sans-serif',
          margin: '0 0 4px 0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 8px'
        }} title={fileName}>
          {fileName}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
          Audio Player Premium
        </p>
      </div>

      {/* Seekbar and time stamps */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          disabled={isLoading}
          style={{
            width: '100%',
            height: 4,
            borderRadius: 2,
            outline: 'none',
            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.12) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.12) 100%)`,
            cursor: 'pointer',
            WebkitAppearance: 'none',
          }}
          className="audio-seekbar"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16 }}>
        {/* Mute button */}
        <button
          onClick={toggleMute}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', opacity: 0.8, padding: 8, display: 'flex', alignItems: 'center'
          }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Volume Seeker */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          style={{
            width: 80,
            height: 3,
            borderRadius: 1.5,
            outline: 'none',
            background: `linear-gradient(to right, #a8c7fa 0%, #a8c7fa ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.12) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.12) 100%)`,
            cursor: 'pointer',
            WebkitAppearance: 'none',
            marginRight: 'auto'
          }}
        />

        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--primary)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(11,87,208,0.4)',
            transition: 'transform 0.15s, background 0.15s',
            flexShrink: 0
          }}
          onMouseEnter={e => { if(!isLoading) e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={e => { if(!isLoading) e.currentTarget.style.transform = 'none'; }}
        >
          {isPlaying ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" style={{ marginLeft: 3 }} />}
        </button>
      </div>

      <style>{`
        .audio-seekbar::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          transition: transform 0.1s;
        }
        .audio-seekbar::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}
