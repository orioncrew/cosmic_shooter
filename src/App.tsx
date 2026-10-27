import { useState, useRef, useCallback, useEffect } from 'react';
import { Game } from './game/Game';
import { Difficulty, GameStats } from './game/types';
import { audio } from './game/audio';

type Screen = 'menu' | 'difficulty' | 'playing' | 'gameover';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    setScreen('playing');
    audio.init();
  }, []);

  useEffect(() => {
    if (screen === 'playing' && canvasRef.current) {
      const canvas = canvasRef.current;
      const game = new Game(canvas, difficulty);
      gameRef.current = game;
      
      game.onGameOver = (stats) => {
        setFinalStats(stats);
        setScreen('gameover');
      };

      game.onExit = () => {
        game.stop();
        gameRef.current = null;
        setScreen('menu');
      };

      game.start();

      return () => {
        game.stop();
        gameRef.current = null;
      };
    }
  }, [screen, difficulty]);

  useEffect(() => {
    audio.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="game-container">
      {screen === 'playing' && (
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            objectFit: 'contain',
            border: '1px solid #00ffcc33',
            cursor: 'crosshair',
          }}
        />
      )}

      {screen === 'menu' && (
        <div className="menu-overlay">
          <div style={{
            fontSize: '5rem',
            marginBottom: '0.5rem',
            filter: 'drop-shadow(0 0 20px #00ffcc)'
          }}>🚀</div>
          <div className="menu-title" style={{ fontSize: '3rem', lineHeight: 1.2 }}>
            КОСМИЧЕСКИЙ<br/>СТРЕЛОК
          </div>
          <div className="menu-subtitle">Защити галактику от инопланетного вторжения!</div>
          
          <button className="menu-btn" onClick={() => setScreen('difficulty')}>
            ▶ НАЧАТЬ ИГРУ
          </button>
          
          <button 
            className="menu-btn" 
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? '🔊 Звук: ВКЛ' : '🔇 Звук: ВЫКЛ'}
          </button>

          <div style={{ 
            marginTop: '2.5rem', 
            color: '#557788', 
            fontSize: '13px', 
            textAlign: 'center',
            lineHeight: 1.8,
            background: 'rgba(0,20,40,0.5)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            border: '1px solid rgba(0,255,204,0.1)'
          }}>
            <p style={{ color: '#00ffcc', fontWeight: 'bold', marginBottom: '0.5rem' }}>УПРАВЛЕНИЕ:</p>
            <p><span style={{ color: '#ffcc00' }}>W A S D</span> — движение корабля</p>
            <p><span style={{ color: '#ffcc00' }}>ЛКМ</span> — стрельба основным оружием</p>
            <p><span style={{ color: '#ffcc00' }}>ПКМ</span> — использовать ульту</p>
            <p><span style={{ color: '#ffcc00' }}>P</span> — пауза</p>
          </div>
        </div>
      )}

      {screen === 'difficulty' && (
        <div className="menu-overlay">
          <div className="menu-title" style={{ fontSize: '2.5rem' }}>ВЫБОР СЛОЖНОСТИ</div>
          
          <button 
            className={`menu-btn ${difficulty === 'easy' ? 'selected' : ''}`}
            onClick={() => startGame('easy')}
          >
            🟢 ЛЕГКО
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              Враги слабее, больше времени на реакцию
            </div>
          </button>
          
          <button 
            className={`menu-btn ${difficulty === 'normal' ? 'selected' : ''}`}
            onClick={() => startGame('normal')}
          >
            🟡 НОРМАЛЬНО
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              Сбалансированная сложность
            </div>
          </button>
          
          <button 
            className={`menu-btn ${difficulty === 'hard' ? 'selected' : ''}`}
            onClick={() => startGame('hard')}
          >
            🔴 СЛОЖНО
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              Больше врагов, больше очков
            </div>
          </button>

          <button className="menu-btn" onClick={() => setScreen('menu')} style={{ marginTop: '1rem' }}>
            ← НАЗАД
          </button>
        </div>
      )}

      {screen === 'gameover' && finalStats && (
        <div className="menu-overlay">
          <div className="menu-title" style={{ fontSize: '2.5rem', color: '#ff4444', textShadow: '0 0 20px #ff4444, 0 0 40px #ff0000' }}>
            💥 ИГРА ОКОНЧЕНА
          </div>
          
          <div className="stats-panel">
            <h3 style={{ color: '#00ffcc', marginBottom: '1rem', textAlign: 'center', fontSize: '1.3rem' }}>
              📊 Боевая статистика
            </h3>
            
            <div className="stats-row">
              <span>🏆 Финальный счёт:</span>
              <span style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: '1.1rem' }}>{finalStats.maxScore.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span>🌊 Волна достигнута:</span>
              <span style={{ color: '#00ccff' }}>{finalStats.waveReached}</span>
            </div>
            <div className="stats-row">
              <span>💀 Врагов уничтожено:</span>
              <span>{finalStats.enemiesKilled}</span>
            </div>
            <div className="stats-row">
              <span>👹 Боссов побеждено:</span>
              <span style={{ color: '#ff6600' }}>{finalStats.bossesKilled}</span>
            </div>
            <div className="stats-row">
              <span>🔫 Выстрелов сделано:</span>
              <span>{finalStats.shotsFired}</span>
            </div>
            <div className="stats-row">
              <span>🎁 Призов собрано:</span>
              <span style={{ color: '#44ff44' }}>{finalStats.pickupsCollected}</span>
            </div>
            <div className="stats-row">
              <span>💥 Урон нанесён:</span>
              <span>{Math.floor(finalStats.damageDealt).toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span>💔 Урон получен (попаданий):</span>
              <span style={{ color: '#ff4444' }}>{finalStats.damageTaken}</span>
            </div>
            <div className="stats-row">
              <span>⏱ Время в игре:</span>
              <span>{formatTime(finalStats.timePlayed)}</span>
            </div>
            <div className="stats-row">
              <span>⚡ Сложность:</span>
              <span>
                {difficulty === 'easy' ? '🟢 Легко' : difficulty === 'normal' ? '🟡 Нормально' : '🔴 Сложно'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="menu-btn" onClick={() => startGame(difficulty)}>
              🔄 ИГРАТЬ СНОВА
            </button>
            <button className="menu-btn" onClick={() => setScreen('menu')}>
              🏠 В МЕНЮ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
