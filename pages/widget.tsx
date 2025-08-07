import { useEffect, useState } from 'react';
import { withAuth } from '@/lib/withAuth';
import AdminLayout from '@/components/layout/AdminLayout';

interface WidgetSettings {
  widget_title: string;
  widget_color: string;
  widget_position: 'left' | 'right';
}

function WidgetPage() {
  const [settings, setSettings] = useState<WidgetSettings>({
    widget_title: '',
    widget_color: '#3b82f6',
    widget_position: 'right',
  });
  const [loading, setLoading] = useState(true);
  const [iframeCode, setIframeCode] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/widget/settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          generateIframeCode(data);
        }
      } catch (err) {
        console.error('Error fetching widget settings:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchSettings();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/widget/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        generateIframeCode(updated);
        alert('Zapisano ustawienia widgetu.');
      } else {
        alert('Błąd podczas zapisu.');
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const generateIframeCode = (cfg: WidgetSettings) => {
    const code = `<iframe src="https://yourdomain.com/widget?title=${encodeURIComponent(cfg.widget_title)}&color=${cfg.widget_color}&position=${cfg.widget_position}" width="100%" height="400px" style="border: none;"></iframe>`;
    setIframeCode(code);
  };

  if (loading) return <AdminLayout>Ładowanie...</AdminLayout>;

  return (
    <AdminLayout>
      <h2 clas
