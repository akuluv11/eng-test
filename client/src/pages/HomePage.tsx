import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { Round } from '../types/api';

function phaseLabel(round: Round, now: Date): string {
  const t = now.getTime();
  const start = new Date(round.start_datetime).getTime();
  const end = new Date(round.end_datetime).getTime();
  if (t >= end) return 'Завершён';
  if (t >= start) return 'Активен';
  return 'Cooldown';
}

export const HomePage: React.FC = () => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingRound, setCreatingRound] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const navigate = useNavigate();
  const player = apiService.decodeToken();

  const fetchRounds = useCallback(async (isInitial: boolean) => {
    try {
      if (isInitial) setLoading(true);
      const roundsData = await apiService.getRounds();
      setRounds(roundsData);
    } catch (err) {
      setError('Ошибка загрузки раундов');
      if (err instanceof Error && err.message.includes('Authentication')) {
        apiService.removeToken();
        navigate('/auth');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void fetchRounds(true);
    const interval = setInterval(() => void fetchRounds(false), 3000);
    return () => clearInterval(interval);
  }, [fetchRounds]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => {
    apiService.removeToken();
    navigate('/auth');
  };

  const handleCreateRound = async () => {
    try {
      setCreatingRound(true);
      setError('');
      const created = await apiService.createRound();
      const refreshed = await apiService.getRounds();
      setRounds(refreshed);
      navigate(`/round/${created.uuid}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания раунда');
    } finally {
      setCreatingRound(false);
    }
  };

  const formatDate = (date: string | Date) => new Date(date).toLocaleString('ru-RU');

  if (loading) {
    return (
        <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '100vh',
              backgroundColor: '#1a1d23',
            }}
        >
          <div style={{ color: '#c5c8ce', fontSize: '1.1rem' }}>Загрузка раундов…</div>
        </div>
    );
  }

  return (
      <div style={{ minHeight: '100vh', backgroundColor: '#1a1d23', padding: '1.5rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <header
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                padding: '1rem 1.25rem',
                backgroundColor: '#252830',
                borderRadius: 12,
                border: '1px solid #353a45',
              }}
          >
            <h1 style={{ margin: 0, color: '#e8eaed', fontSize: '1.35rem', fontWeight: 600 }}>
              Список раундов
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ color: '#9aa0a6', fontSize: '0.95rem' }}>
              {player?.username ?? 'Игрок'}
            </span>
              {apiService.isAdmin() && (
                  <button
                      type="button"
                      onClick={() => void handleCreateRound()}
                      disabled={creatingRound}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: creatingRound ? '#4a5568' : '#3d7a4a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: creatingRound ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                  >
                    {creatingRound ? 'Создание…' : 'Создать раунд'}
                  </button>
              )}
              <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#5c2b2b',
                    color: '#f0d0d0',
                    border: '1px solid #7a3a3a',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
              >
                Выйти
              </button>
            </div>
          </header>

          {error && (
              <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.85rem 1rem',
                    backgroundColor: '#3d2424',
                    color: '#f5c0c0',
                    borderRadius: 8,
                    border: '1px solid #5c3030',
                  }}
              >
                {error}
              </div>
          )}

          {rounds.length === 0 ? (
              <div
                  style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: '#9aa0a6',
                    backgroundColor: '#252830',
                    borderRadius: 12,
                    border: '1px solid #353a45',
                  }}
              >
                Нет активных или запланированных раундов
              </div>
          ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {rounds.map((round) => {
                  const phase = phaseLabel(round, now);
                  const phaseColor =
                      phase === 'Активен' ? '#3d7a4a' : phase === 'Cooldown' ? '#b8860b' : '#6b7280';
                  return (
                      <li
                          key={round.uuid}
                          style={{
                            backgroundColor: '#252830',
                            borderRadius: 12,
                            border: '1px solid #353a45',
                            padding: '1.25rem 1.5rem',
                          }}
                      >
                        <div style={{ marginBottom: '0.75rem' }}>
                          <Link
                              to={`/round/${round.uuid}`}
                              style={{
                                color: '#7eb8ff',
                                textDecoration: 'none',
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '0.9rem',
                                wordBreak: 'break-all',
                              }}
                          >
                            ● Round ID: {round.uuid}
                          </Link>
                        </div>
                        <div style={{ color: '#c5c8ce', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          <div>
                            <strong style={{ color: '#9aa0a6' }}>Start:</strong> {formatDate(round.start_datetime)}
                          </div>
                          <div>
                            <strong style={{ color: '#9aa0a6' }}>End:</strong>{' '}
                            {round.end_datetime ? formatDate(round.end_datetime) : '—'}
                          </div>
                        </div>
                        <div
                            style={{
                              marginTop: '1rem',
                              paddingTop: '1rem',
                              borderTop: '1px solid #353a45',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                        >
                          <span style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>Статус:</span>
                          <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.65rem',
                                borderRadius: 999,
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                backgroundColor: phaseColor,
                                color: '#fff',
                              }}
                          >
                      {phase}
                    </span>
                        </div>
                      </li>
                  );
                })}
              </ul>
          )}
        </div>
      </div>
  );
};