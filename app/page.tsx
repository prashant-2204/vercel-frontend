"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Github } from 'lucide-react';
import { Fira_Code } from 'next/font/google';

const socket: Socket = io('https://vercel-api-server.onrender.com');

const firaCode = Fira_Code({ subsets: ['latin'] });

const Home: React.FC = () => {
  const [repoURL, setURL] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<string | undefined>();
  const [countdown, setCountdown] = useState<number>(0); // Countdown timer in seconds
  const [showTimer, setShowTimer] = useState<boolean>(false); // Flag to show the timer
  const logContainerRef = useRef<HTMLElement>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === '') return [false, null];
    const regex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/;
    return [regex.test(repoURL), 'Enter valid Github Repository URL'];
  }, [repoURL]);

  const handleClickDeploy = useCallback(async () => {
    setLoading(true);

    try {
      const { data } = await axios.post('https://vercel-api-server.onrender.com/project', {
        gitURL: repoURL,
        slug: projectId,
      });

      if (data && data.data) {
        const { projectSlug, url } = data.data;
        setProjectId(projectSlug);
        setDeployPreviewURL(url);

        console.log(`Subscribing to logs:${projectSlug}`);
        socket.emit('subscribe', `logs:${projectSlug}`);
        
        // Start the timer after deployment is initiated
        setCountdown(60);
        setShowTimer(true);
      }
    } catch (error) {
      console.error('Failed to deploy:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, repoURL]);

  const handleSocketIncommingMessage = useCallback((message: string) => {
    console.log('[Incoming Socket Message]:', typeof message, message);
    try {
      const parsedMessage = JSON.parse(message);
      const { log } = parsedMessage;
      setLogs((prevLogs) => [...prevLogs, log]);
      logContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to parse incoming message:', error);
    }
  }, []);

  useEffect(() => {
    socket.on('message', handleSocketIncommingMessage);

    return () => {
      socket.off('message', handleSocketIncommingMessage);
    };
  }, [handleSocketIncommingMessage]);

  useEffect(() => {
    let countdownTimer: NodeJS.Timeout;

    if (showTimer && countdown > 0) {
      countdownTimer = setTimeout(() => {
        setCountdown((prevCountdown) => prevCountdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      // Countdown has finished, show preview URL
      setShowTimer(false);
    }

    return () => clearTimeout(countdownTimer);
  }, [countdown, showTimer]);

  return (
    <main className="flex justify-center items-center h-[100vh]">
      <div className="w-[600px]">
        <span className="flex justify-start items-center gap-2">
          <Github className="text-5xl" />
          <Input
            disabled={loading}
            value={repoURL}
            onChange={(e) => setURL(e.target.value)}
            type="url"
            placeholder="Github URL"
          />
        </span>
        <Button
          onClick={handleClickDeploy}
          disabled={!isValidURL[0] || loading}
          className="w-full mt-3"
        >
          {loading ? 'In Progress' : 'Deploy'}
        </Button>
        {showTimer && countdown > 0 && (
          <div className="mt-2 bg-slate-900 py-4 px-2 rounded-lg">
            <p>Deploying... Showing preview URL in {countdown} seconds...</p>
          </div>
        )}
        {!showTimer && deployPreviewURL && (
          <div className="mt-2 bg-slate-900 py-4 px-2 rounded-lg">
            <p>
              Preview URL{' '}
              <a
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 bg-sky-950 px-3 py-2 rounded-lg"
                href={deployPreviewURL}
              >
                {deployPreviewURL}
              </a>
            </p>
          </div>
        )}
        {logs.length > 0 && (
          <div
            className={`${firaCode.className} text-sm text-green-500 logs-container mt-5 border-green-500 border-2 rounded-lg p-4 h-[300px] overflow-y-auto`}
          >
            <pre className="flex flex-col gap-1">
              {logs.map((log, i) => (
                <code
                  ref={logs.length - 1 === i ? logContainerRef : undefined}
                  key={i}
                >{`> ${log}`}</code>
              ))}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
};

export default Home;
