import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AuthOverlay from './components/AuthOverlay';
import Dashboard from './components/Dashboard';
import { ShieldCheck } from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const isAuthenticated = session?.isVerified;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/20 relative grid-bg overflow-hidden">

      {/* Ambient glows */}
      <div className="fixed top-[-20%] left-[15%] w-[500px] h-[500px] bg-cyan-500/[0.03] blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[10%] w-[400px] h-[400px] bg-rose-500/[0.02] blur-[140px] rounded-full pointer-events-none" />

      {/* Full-height layout */}
      <main className="relative z-10 min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex items-center justify-center p-4"
            >
              <AuthOverlay onVerified={setSession} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              <Dashboard session={session} setSession={setSession} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
