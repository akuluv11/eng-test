import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { RoundResponse, RoundWithResultsResponse } from '../types/api';
import gussReady from '../assets/guss_ready.png';
import gussStop from '../assets/guss_stop.png';
import gussTapped from '../assets/guss_tapped.png';
import './RoundPage.css';

function formatMmSs(diffMs: number): string {
  if (diffMs <= 0) return '00:00';
  const totalSec = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const RoundPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [roundData, setRoundData] = useState<RoundResponse | RoundWithResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isTapping, setIsTapping] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [tapHint, setTapHint] = useState<string | null>(null);
  const fetchedEndRef = useRef(false);
  const player = apiService.decodeToken();

  const fetchRoundData = useCallback(async () => {
    if (!uuid) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await apiService.getRound(uuid);

      setRoundData(data);
      setDisplayScore(data.currentUserScore);

      const endMs = new Date(data.round.end_datetime).getTime();

      fetchedEndRef.current = Date.now() >= endMs;
    } catch {
      setError('Ошибка загрузки данных раунда');
      setRoundData(null);
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    fetchedEndRef.current = false;

    void fetchRoundData();
  }, [fetchRoundData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roundData) {
      return;
    }

    const endMs = new Date(roundData.round.end_datetime).getTime();
    const finished = currentTime.getTime() >= endMs;

    if (finished && !fetchedEndRef.current) {
      fetchedEndRef.current = true;
      void fetchRoundData();
    }
  }, [currentTime, roundData, fetchRoundData]);

  const handleTap = async () => {
    if (!roundData || !uuid) {
      return;
    }

    const startTime = new Date(roundData.round.start_datetime).getTime();
    const endTime = new Date(roundData.round.end_datetime).getTime();
    const t = currentTime.getTime();

    if (t < startTime || t >= endTime) {
      return;
    }

    try {
      setIsTapping(true);
      setTapHint(null);

      const response = await apiService.tap(uuid);

      setDisplayScore(response.score);
    } catch (e) {
      setTapHint(e instanceof Error ? e.message : 'Тап не засчитан');
    } finally {
      setTimeout(() => setIsTapping(false), 120);
    }
  };

  if (loading && !roundData) {
    return (
        <div className="round-page">
          <div className="loading">Загрузка…</div>
        </div>
    );
  }

  if (error || !roundData) {
    return (
        <div className="round-page">
          <div className="error">{error || 'Раунд не найден'}</div>
          <button type="button" onClick={() => navigate('/')} className="back-button">
            К списку раундов
          </button>
        </div>
    );
  }

  const { round } = roundData;

  const startTime = new Date(round.start_datetime);
  const endTime = new Date(round.end_datetime);
  const t = currentTime.getTime();
  const isBeforeStart = t < startTime.getTime();
  const isActive = t >= startTime.getTime() && t < endTime.getTime();
  const isFinished = t >= endTime.getTime();

  const countdownToStart = formatMmSs(startTime.getTime() - t);
  const countdownToEnd = formatMmSs(endTime.getTime() - t);

  const getCurrentImage = () => {
    if (isTapping) {
      return gussTapped;
    }

    if (isActive) {
      return gussReady;
    }

    return gussStop;
  };

  const formatDateTime = (date: Date) =>
      date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  const headerTitle = isBeforeStart ? 'Cooldown' : isActive ? 'Раунд' : 'Раунд завершён';

  return (
      <div className="round-page">
        <div className="round-header">
          <button type="button" onClick={() => navigate('/')} className="back-button">
            ← Раунды
          </button>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '1.1rem' }}>{headerTitle}</h1>
            <div style={{ color: '#9aa0a6', fontSize: '0.9rem', marginTop: 4 }}>{player?.username}</div>
          </div>
        </div>

        <div className="round-info">
          <div className="round-details">
            <div className="detail-item">
              <span className="label">Начало:</span>
              <span className="value">{formatDateTime(startTime)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Окончание:</span>
              <span className="value">{formatDateTime(endTime)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Состояние:</span>
              <span className={`status ${isActive ? 'active' : isFinished ? 'finished' : 'waiting'}`}>
              {isBeforeStart ? 'Cooldown' : isActive ? 'Активен' : 'Завершён'}
            </span>
            </div>
          </div>

          {isBeforeStart && (
              <div className="countdown">
                <h2>Cooldown</h2>
                <p style={{ color: '#9aa0a6', marginTop: 0 }}>до начала раунда</p>
                <div className="countdown-timer">{countdownToStart}</div>
              </div>
          )}

          {isActive && (
              <div className="active-round">
                <h2>Раунд активен!</h2>
                <div className="time-remaining">До конца осталось: {countdownToEnd}</div>
                <div className="score-section">
                  <h3>Мои очки — {displayScore}</h3>
                </div>
              </div>
          )}

          {isFinished && 'totalScore' in roundData && roundData.totalScore !== undefined && (
              <div className="round-results">
                <h2>Итоги</h2>
                <div className="results-grid">
                  <div className="result-item">
                    <span className="result-label">Всего</span>
                    <span className="result-value">{roundData.totalScore}</span>
                  </div>
                  {roundData.bestPlayer && (
                      <div className="result-item">
                        <span className="result-label">Победитель</span>
                        <span className="result-value">
                    {roundData.bestPlayer.username} — {roundData.bestPlayer.score}
                  </span>
                      </div>
                  )}
                  <div className="result-item">
                    <span className="result-label">Мои очки</span>
                    <span className="result-value">{roundData.currentUserScore}</span>
                  </div>
                </div>
              </div>
          )}

          {tapHint && (
              <div style={{ color: '#f0a0a0', fontSize: '0.9rem', marginTop: 8 }}>{tapHint}</div>
          )}
        </div>

        <div className="guss-container">
          <img
              src={getCurrentImage()}
              alt="Guss"
              className={`guss-image ${isActive ? 'clickable' : ''} ${isTapping ? 'tapping' : ''}`}
              onClick={() => void handleTap()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleTap();
                }
              }}
              role={isActive ? 'button' : undefined}
              tabIndex={isActive ? 0 : undefined}
              draggable={false}
          />
          {isActive && (
              <div className="tap-instruction">Тапайте по гусю, чтобы набрать очки</div>
          )}
          {!isActive && !isFinished && (
              <div className="tap-instruction" style={{ color: '#6b7280' }}>
                Дождитесь начала раунда
              </div>
          )}
        </div>
      </div>
  );
};

export default RoundPage;