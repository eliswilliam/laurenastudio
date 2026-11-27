import { useTranslation } from 'react-i18next';

export function I18nTest() {
  const { t, i18n } = useTranslation();

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#000',
      color: '#fff',
      padding: '20px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
        🌍 i18n Debug
      </div>
      <div>
        <strong>Navigator:</strong> {navigator.language}
      </div>
      <div>
        <strong>i18n Language:</strong> {i18n.language}
      </div>
      <div>
        <strong>localStorage:</strong> {localStorage.getItem('i18nextLng') ?? '(vide — OK)'}
      </div>
      <div style={{ marginTop: '10px' }}>
        <strong>Translation test:</strong><br />
        {t('app.title')} - {t('app.description')}
      </div>
      <div style={{ marginTop: '10px' }}>
        <button
          onClick={() => i18n.changeLanguage('en')}
          style={{ marginRight: '5px', padding: '5px 10px' }}
        >
          EN
        </button>
        <button
          onClick={() => i18n.changeLanguage('pt-BR')}
          style={{ marginRight: '5px', padding: '5px 10px' }}
        >
          PT
        </button>
        <button
          onClick={() => i18n.changeLanguage('es')}
          style={{ marginRight: '5px', padding: '5px 10px' }}
        >
          ES
        </button>
        <button
          onClick={() => i18n.changeLanguage('fr')}
          style={{ padding: '5px 10px' }}
        >
          FR
        </button>
      </div>
      <div style={{ marginTop: '10px' }}>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '5px 10px', background: '#333', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Reload (re-detect browser lang)
        </button>
      </div>
    </div>
  );
}
