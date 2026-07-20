import React, { useState } from 'react';
import changelogData from '../../locales/changelog.json';
import { RefreshCw, CheckCircle, AlertTriangle, Link, Code, Shield, User } from 'lucide-react';
import { CheckForUpdates, OpenReleaseURL } from '../../../wailsjs/go/main/App';

interface ChangelogViewProps {
  lang: string;
}

export default function ChangelogView({ lang }: ChangelogViewProps) {
  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLicense, setShowLicense] = useState(false);

  const handleManualCheck = async () => {
    setChecking(true);
    setUpdateResult(null);
    setErrorMsg('');
    try {
      const info = await CheckForUpdates();
      setUpdateResult(info);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(lang === 'id' ? 'Gagal melakukan pengecekan pembaruan.' : 'Failed to check for updates.');
    } finally {
      setChecking(false);
    }
  };

  const mitLicenseText = lang === 'id' 
    ? `Hak Cipta © 2026 I Putu Agus Wahyu Dupayana\n\nIzin dengan ini diberikan, secara gratis, kepada siapa pun yang memperoleh salinan perangkat lunak ini dan file dokumentasi terkait ("Perangkat Lunak"), untuk menggunakan Perangkat Lunak tanpa batasan, termasuk tanpa batasan hak untuk menggunakan, menyalin, memodifikasi, menggabungkan, menerbitkan, mendistribusikan, mensublisensikan, dan/atau menjual salinan Perangkat Lunak, dan mengizinkan orang yang menerima Perangkat Lunak untuk melakukannya, dengan tunduk pada ketentuan berikut:\n\nPemberitahuan hak cipta di atas dan pemberitahuan izin ini harus dicantumkan dalam semua salinan atau bagian substansial dari Perangkat Lunak.\n\nPERANGKAT LUNAK INI DISEDIAKAN "APA ADANYA", TANPA JAMINAN APA PUN, TERSURAT MAUPUN TERSIRAT, TERMASUK NAMUN TIDAK TERBATAS PADA JAMINAN KELAYAKAN JUAL, KESESUAIAN UNTUK TUJUAN TERTENTU DAN KETIADAAN PELANGGARAN. DALAM HAL APA PUN, PENULIS ATAU PEMEGANG HAK CIPTA TIDAK BERTANGGUNG JAWAB ATAS KLAIM, KERUSAKAN ATAU KEWAJIBAN LAINNYA, BAIK DALAM TINDAKAN KONTRAK, PERBUATAN MELAWAN HUKUM ATAU LAINNYA, YANG TIMBUL DARI, DARI ATAU SEHUBUNGAN DENGAN PERANGKAT LUNAK ATAU PENGGUNAAN ATAU TRANSAKSI LAIN DALAM PERANGKAT LUNAK.`
    : `Copyright © 2026 I Putu Agus Wahyu Dupayana\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

  return (
    <div style={{
      maxWidth: 800, margin: '0 auto', fontFamily: 'Google Sans, Roboto, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40
    }}>
      {/* App About Header */}
      <div style={{
        background: 'var(--md-surface-container-high, #eceef4)',
        borderRadius: 24, padding: 24, display: 'flex', alignItems: 'center', gap: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexWrap: 'wrap'
      }}>
        <img src="/icon.webp" alt="Awd TeleDrive" style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 22, color: 'var(--md-on-surface)' }}>Awd TeleDrive</h3>
          <p style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
            {lang === 'id' 
              ? 'Aplikasi Desktop untuk memanfaatkan Telegram sebagai penyimpanan awan tanpa batas.' 
              : 'Desktop application to use Telegram as unlimited cloud storage.'}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
            <span>{lang === 'id' ? 'Versi saat ini: 1.1.0' : 'Current version: 1.1.0'}</span>
            <span style={{ height: 4, width: 4, borderRadius: '50%', background: 'var(--md-outline)' }}></span>
            <span>© 2026 Awd TeleDrive</span>
          </div>
        </div>
        <div>
          <button
            onClick={handleManualCheck}
            disabled={checking}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--md-primary, #0b57d0)', color: 'var(--md-on-primary, #fff)',
              border: 'none', padding: '10px 20px', borderRadius: 100,
              fontSize: 14, fontWeight: 500, cursor: checking ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)', opacity: checking ? 0.8 : 1,
              transition: 'filter 0.2s, opacity 0.2s'
            }}
            onMouseEnter={e => { if(!checking) e.currentTarget.style.filter = 'brightness(0.9)'; }}
            onMouseLeave={e => { if(!checking) e.currentTarget.style.filter = 'none'; }}
          >
            <RefreshCw size={16} className={checking ? 'spin' : ''} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
            {lang === 'id' ? 'Periksa Pembaruan' : 'Check for Updates'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Manual Check Result */}
      {errorMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'rgba(179,38,30,0.1)', color: '#b3261e', borderRadius: 12, fontSize: 14
        }}>
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {updateResult && (
        <div style={{
          padding: '16px 20px', borderRadius: 16,
          background: updateResult.has_update ? 'var(--md-primary-container, #d3e3fd)' : 'rgba(40,167,69,0.1)',
          color: updateResult.has_update ? 'var(--md-on-primary-container)' : '#1e7e34',
          display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {updateResult.has_update ? (
              <>
                <AlertTriangle size={18} />
                <strong>
                  {lang === 'id' 
                    ? `Pembaruan tersedia! Versi terbaru: ${updateResult.latest_version}` 
                    : `Update available! Latest version: ${updateResult.latest_version}`}
                </strong>
              </>
            ) : (
              <>
                <CheckCircle size={18} style={{ color: '#28a745' }} />
                <strong style={{ color: '#28a745' }}>
                  {lang === 'id' ? 'Aplikasi Anda sudah menggunakan versi terbaru.' : 'Your application is up to date.'}
                </strong>
              </>
            )}
          </div>
          {updateResult.has_update && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
              <button
                onClick={() => OpenReleaseURL(updateResult.update_url)}
                style={{
                  background: 'var(--md-primary, #0b57d0)', color: 'var(--md-on-primary, #fff)', border: 'none',
                  padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: 'pointer'
                }}
              >
                {lang === 'id' ? 'Unduh Pembaruan' : 'Download Update'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Explanations (Links & Legal) from Android App */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16
      }}>
        {/* Tautan (Links) Card */}
        <div style={{
          background: 'var(--md-surface-container-low, #f7f9fc)',
          borderRadius: 20, padding: 20, border: '1px solid var(--md-outline-variant)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--md-on-surface)' }}>
            {lang === 'id' ? 'Tautan Resmi' : 'Official Links'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div 
              onClick={() => OpenReleaseURL('https://teledrive.biz.id')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <div style={{
                background: 'var(--md-surface-container-high)', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--md-primary)'
              }}>
                <Link size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)' }}>
                  {lang === 'id' ? 'Situs Resmi' : 'Official Website'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>teledrive.biz.id</div>
              </div>
            </div>

            <div 
              onClick={() => OpenReleaseURL('https://github.com/putuwahyu29/awd-teledrive-desktop')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <div style={{
                background: 'var(--md-surface-container-high)', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--md-primary)'
              }}>
                <Code size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)' }}>
                  {lang === 'id' ? 'GitHub & Masalah' : 'GitHub & Issues'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>putuwahyu29/awd-teledrive-desktop</div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Legal Card */}
        <div style={{
          background: 'var(--md-surface-container-low, #f7f9fc)',
          borderRadius: 20, padding: 20, border: '1px solid var(--md-outline-variant)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--md-on-surface)' }}>
            {lang === 'id' ? 'Legal & Pembuat' : 'Legal & Creator'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div 
              onClick={() => OpenReleaseURL('https://www.linkedin.com/in/aguswahyu/')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <div style={{
                background: 'var(--md-surface-container-high)', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--md-primary)'
              }}>
                <User size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)' }}>
                  {lang === 'id' ? 'Pembuat' : 'Creator'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>I Putu Agus Wahyu Dupayana</div>
              </div>
            </div>

            <div 
              onClick={() => setShowLicense(!showLicense)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <div style={{
                background: 'var(--md-surface-container-high)', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--md-primary)'
              }}>
                <Shield size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)' }}>
                  {lang === 'id' ? 'Lisensi Perangkat Lunak' : 'Software License'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>MIT License</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MIT License Text Expander */}
      {showLicense && (
        <div style={{
          background: 'var(--md-surface-container-low, #f7f9fc)',
          borderRadius: 20, padding: 20, border: '1px solid var(--md-outline-variant)',
          fontSize: 12, color: 'var(--md-on-surface-variant)', lineHeight: '1.6',
          whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <strong>MIT License</strong>
          <br /><br />
          {mitLicenseText}
        </div>
      )}

      {/* Changelog Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--md-on-surface)' }}>
          {lang === 'id' ? 'Catatan Rilis (Changelog)' : 'Release Notes (Changelog)'}
        </h4>

        {changelogData.map((item, index) => (
          <div key={item.version} style={{
            display: 'flex', gap: 16, position: 'relative'
          }}>
            {/* Timeline Line & Dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: index === 0 ? 'var(--md-primary)' : 'var(--md-outline-variant)',
                marginTop: 6, zIndex: 2
              }} />
              {index < changelogData.length - 1 && (
                <div style={{
                  width: 2, flex: 1, background: 'var(--md-outline-variant)',
                  marginTop: 4, marginBottom: -6, zIndex: 1
                }} />
              )}
            </div>

            {/* Changelog Card */}
            <div style={{
              flex: 1, background: 'var(--md-surface-container-low, #f7f9fc)',
              borderRadius: 16, padding: 18, border: '1px solid var(--md-outline-variant)',
              marginBottom: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--md-on-surface)' }}>
                  {item.title[lang as 'id' | 'en'] || item.title.en}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, background: index === 0 ? 'var(--md-secondary-container)' : 'transparent',
                    color: index === 0 ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                    padding: '2px 8px', borderRadius: 6, border: '1px solid var(--md-outline-variant)'
                  }}>
                    v{item.version}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{item.date}</span>
                </div>
              </div>

              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: '1.6', color: 'var(--md-on-surface-variant)' }}>
                {(item.changes[lang as 'id' | 'en'] || item.changes.en).map((change, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{change}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
