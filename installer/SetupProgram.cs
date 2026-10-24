using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace OmniverseInstaller
{
    public class SetupForm : Form
    {
        private System.Windows.Forms.Timer animTimer;
        private float glowAngle = 0f;
        private int progressPercent = 0;
        private string currentPhaseText = "Initializing Aksharbrahm Chidakash Conduit...";
        private string currentDetailText = "Preparing extraction expanse...";
        private bool isFinished = false;
        private bool isExtracting = false;

        private Button btnAction;
        private Label lblPill;
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblPhase;
        private Label lblDetail;
        private Label lblClose;
        private Panel cardPanel;
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;

        private readonly Color bgObsidian = Color.FromArgb(6, 7, 11);
        private readonly Color cardBg = Color.FromArgb(12, 14, 20);
        private readonly Color goldLight = Color.FromArgb(243, 229, 171);
        private readonly Color goldDim = Color.FromArgb(160, 145, 95);
        private readonly Color textMuted = Color.FromArgb(160, 160, 170);

        // Windows dragging
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        public SetupForm()
        {
            this.Text = "OMNIVERSE Setup — Manifesting Expanse";
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new Size(650, 460);
            this.BackColor = bgObsidian;
            this.DoubleBuffered = true;
            this.SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            InitializeComponents();

            animTimer = new System.Windows.Forms.Timer();
            animTimer.Interval = 25;
            animTimer.Tick += (s, e) =>
            {
                glowAngle += 0.04f;
                this.Invalidate();
            };
            animTimer.Start();

            this.Shown += (s, e) =>
            {
                // Auto-start extraction after smooth reveal
                ThreadPool.QueueUserWorkItem(state =>
                {
                    Thread.Sleep(600);
                    StartInstallation();
                });
            };
        }

        private void InitializeComponents()
        {
            // Close button
            lblClose = new Label
            {
                Text = "✕",
                Font = new Font("Segoe UI", 11, FontStyle.Regular),
                ForeColor = Color.FromArgb(120, 120, 130),
                BackColor = Color.Transparent,
                Size = new Size(30, 30),
                Location = new Point(this.Width - 38, 10),
                Cursor = Cursors.Hand,
                TextAlign = ContentAlignment.MiddleCenter
            };
            lblClose.MouseEnter += (s, e) => lblClose.ForeColor = goldLight;
            lblClose.MouseLeave += (s, e) => lblClose.ForeColor = Color.FromArgb(120, 120, 130);
            lblClose.Click += (s, e) => Application.Exit();
            this.Controls.Add(lblClose);

            // Drag handle on form background
            this.MouseDown += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                }
            };

            // Pill Badge
            lblPill = new Label
            {
                Text = "BOUNDLESS STREAMS • ONE LUMINOUS CORE",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = goldLight,
                BackColor = Color.FromArgb(20, 24, 34),
                Size = new Size(320, 24),
                Location = new Point((this.Width - 320) / 2, 35),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(lblPill);

            // Main Title
            lblTitle = new Label
            {
                Text = "OMNIVERSE",
                Font = new Font("Segoe UI Light", 26, FontStyle.Regular),
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Size = new Size(this.Width, 48),
                Location = new Point(0, 68),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(lblTitle);

            // Subtitle
            lblSubtitle = new Label
            {
                Text = "“Where infinite streams float like particles in pure light.”",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Italic),
                ForeColor = textMuted,
                BackColor = Color.Transparent,
                Size = new Size(this.Width, 24),
                Location = new Point(0, 116),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(lblSubtitle);

            // Main Glass Card Panel
            cardPanel = new Panel
            {
                Size = new Size(570, 215),
                Location = new Point(40, 155),
                BackColor = cardBg
            };
            cardPanel.Paint += CardPanel_Paint;
            this.Controls.Add(cardPanel);

            // Phase Header inside card
            lblPhase = new Label
            {
                Text = currentPhaseText,
                Font = new Font("Segoe UI Semibold", 11.5f, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Location = new Point(20, 20),
                Size = new Size(530, 26),
                TextAlign = ContentAlignment.MiddleLeft
            };
            cardPanel.Controls.Add(lblPhase);

            // Detail line inside card
            lblDetail = new Label
            {
                Text = currentDetailText,
                Font = new Font("Consolas", 8.5f, FontStyle.Regular),
                ForeColor = goldDim,
                BackColor = Color.Transparent,
                Location = new Point(20, 48),
                Size = new Size(530, 22),
                TextAlign = ContentAlignment.MiddleLeft
            };
            cardPanel.Controls.Add(lblDetail);

            // Options Checkboxes
            chkDesktop = new CheckBox
            {
                Text = "Create Desktop Portal Shortcut",
                Checked = true,
                Font = new Font("Segoe UI", 9, FontStyle.Regular),
                ForeColor = Color.FromArgb(200, 200, 210),
                BackColor = Color.Transparent,
                Location = new Point(25, 128),
                Size = new Size(230, 24)
            };
            cardPanel.Controls.Add(chkDesktop);

            chkStartMenu = new CheckBox
            {
                Text = "Register in Windows Start Menu",
                Checked = true,
                Font = new Font("Segoe UI", 9, FontStyle.Regular),
                ForeColor = Color.FromArgb(200, 200, 210),
                BackColor = Color.Transparent,
                Location = new Point(270, 128),
                Size = new Size(240, 24)
            };
            cardPanel.Controls.Add(chkStartMenu);

            // Bottom Action Button
            btnAction = new Button
            {
                Text = "Manifesting...",
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.Black,
                BackColor = goldLight,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(240, 40),
                Location = new Point((this.Width - 240) / 2, 390),
                Cursor = Cursors.Hand,
                Enabled = false
            };
            btnAction.FlatAppearance.BorderSize = 0;
            btnAction.Click += (s, e) =>
            {
                if (isFinished)
                {
                    LaunchInstalledApp();
                    Application.Exit();
                }
            };
            this.Controls.Add(btnAction);
        }

        private void CardPanel_Paint(object sender, PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // 1. Draw delicate 1px border around card
            using (Pen borderPen = new Pen(Color.FromArgb(255, 255, 255, 18), 1))
            {
                g.DrawRectangle(borderPen, 0, 0, cardPanel.Width - 1, cardPanel.Height - 1);
            }

            // 2. Custom Progress Bar Track
            int trackX = 20;
            int trackY = 82;
            int trackW = cardPanel.Width - 40;
            int trackH = 12;

            using (SolidBrush trackBrush = new SolidBrush(Color.FromArgb(18, 20, 28)))
            {
                g.FillRectangle(trackBrush, trackX, trackY, trackW, trackH);
            }
            using (Pen trackBorder = new Pen(Color.FromArgb(50, 45, 30), 1))
            {
                g.DrawRectangle(trackBorder, trackX, trackY, trackW, trackH);
            }

            // 3. Progress Beam Fill
            if (progressPercent > 0)
            {
                int fillW = (int)((trackW * Math.Min(progressPercent, 100)) / 100f);
                if (fillW > 0)
                {
                    using (LinearGradientBrush fillBrush = new LinearGradientBrush(
                        new Point(trackX, trackY),
                        new Point(trackX + fillW, trackY),
                        Color.FromArgb(243, 229, 171),
                        Color.FromArgb(255, 252, 240)))
                    {
                        g.FillRectangle(fillBrush, trackX, trackY, fillW, trackH);
                    }

                    // Radiant Paramanu Core at leading edge
                    int coreX = trackX + fillW;
                    int coreY = trackY + trackH / 2;
                    using (SolidBrush glowBrush = new SolidBrush(Color.FromArgb(180, 255, 255, 255)))
                    {
                        g.FillEllipse(glowBrush, coreX - 5, coreY - 5, 10, 10);
                    }
                    using (SolidBrush whiteBrush = new SolidBrush(Color.White))
                    {
                        g.FillEllipse(whiteBrush, coreX - 2, coreY - 2, 4, 4);
                    }
                }
            }

            // Percentage label text on right
            string pctText = string.Format("{0}%", progressPercent);
            using (Font f = new Font("Consolas", 8.5f, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(goldLight))
            {
                SizeF sz = g.MeasureString(pctText, f);
                g.DrawString(pctText, f, b, trackX + trackW - sz.Width, trackY + trackH + 6);
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // Cosmic ambient radial glow behind title
            int cx = this.Width / 2;
            int cy = 90;
            using (GraphicsPath path = new GraphicsPath())
            {
                path.AddEllipse(cx - 240, cy - 80, 480, 160);
                using (PathGradientBrush pgb = new PathGradientBrush(path))
                {
                    pgb.CenterColor = Color.FromArgb(22, 243, 229, 171);
                    pgb.SurroundColors = new Color[] { Color.FromArgb(0, 6, 7, 11) };
                    g.FillPath(pgb, path);
                }
            }

            // Outer 1px golden frame
            using (Pen borderPen = new Pen(Color.FromArgb(70, 243, 229, 171), 1))
            {
                g.DrawRectangle(borderPen, 0, 0, this.Width - 1, this.Height - 1);
            }
        }

        private void StartInstallation()
        {
            if (isExtracting) return;
            isExtracting = true;

            try
            {
                string targetDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Programs",
                    "Omniverse"
                );

                UpdateProgress(5, "Aligning the Chidakash Expanse...", "Preparing target directory: " + targetDir);
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                // Load embedded bundle
                var assembly = Assembly.GetExecutingAssembly();
                string resourceName = "omniverse_bundle.zip";

                Stream resStream = null;
                foreach (var name in assembly.GetManifestResourceNames())
                {
                    if (name.EndsWith(resourceName, StringComparison.OrdinalIgnoreCase))
                    {
                        resStream = assembly.GetManifestResourceStream(name);
                        break;
                    }
                }

                if (resStream == null)
                {
                    throw new Exception("Embedded payload 'omniverse_bundle.zip' was not found in the executable.");
                }

                using (resStream)
                using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                {
                    // Calculate total uncompressed size for accurate percentage
                    long totalBytes = 0;
                    foreach (var entry in archive.Entries)
                    {
                        totalBytes += entry.Length;
                    }
                    if (totalBytes <= 0) totalBytes = 1;

                    long extractedBytes = 0;
                    byte[] buffer = new byte[64 * 1024];

                    foreach (var entry in archive.Entries)
                    {
                        string entryName = entry.FullName.Replace('/', '\\');
                        string destPath = Path.Combine(targetDir, entryName);

                        if (entryName.EndsWith("\\"))
                        {
                            Directory.CreateDirectory(destPath);
                            continue;
                        }

                        string parent = Path.GetDirectoryName(destPath);
                        if (!Directory.Exists(parent))
                        {
                            Directory.CreateDirectory(parent);
                        }

                        // Determine phase description based on file
                        string phaseDesc = "Manifesting stream components...";
                        if (entryName.IndexOf("node.exe", StringComparison.OrdinalIgnoreCase) >= 0)
                            phaseDesc = "Materializing Luminous Runtime (Node.js engine)...";
                        else if (entryName.IndexOf("yt-dlp.exe", StringComparison.OrdinalIgnoreCase) >= 0)
                            phaseDesc = "Extracting Boundless Stream Conduit (yt-dlp engine)...";
                        else if (entryName.IndexOf("ffmpeg.exe", StringComparison.OrdinalIgnoreCase) >= 0)
                            phaseDesc = "Forging Celestial Media Conduit (FFmpeg muxer)...";
                        else if (entryName.IndexOf("public", StringComparison.OrdinalIgnoreCase) >= 0)
                            phaseDesc = "Deploying Pure Form Interface & Tatvajnana Core...";
                        else if (entryName.IndexOf("server.js", StringComparison.OrdinalIgnoreCase) >= 0)
                            phaseDesc = "Configuring local conduit server...";
                        else if (entryName.IndexOf("OMNIVERSE.exe", StringComparison.OrdinalIgnoreCase) >= 0)
                            phaseDesc = "Deploying standalone desktop portal...";

                        string detailDesc = string.Format("Extracting: {0} ({1:N1} MB)", entryName, entry.Length / (1024f * 1024f));

                        using (Stream entryStream = entry.Open())
                        using (FileStream fs = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                        {
                            int read;
                            while ((read = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                fs.Write(buffer, 0, read);
                                extractedBytes += read;

                                int currentPct = 5 + (int)((extractedBytes * 85L) / totalBytes);
                                UpdateProgress(currentPct, phaseDesc, detailDesc);
                            }
                        }
                    }
                }

                // Create Shortcuts
                UpdateProgress(92, "Forging Desktop & System Portals...", "Generating celestial icons and shortcuts...");
                string exePath = Path.Combine(targetDir, "OMNIVERSE.exe");
                string iconPath = Path.Combine(targetDir, "omniverse.ico");

                if (chkDesktop.Checked)
                {
                    string desktopPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "OMNIVERSE.lnk");
                    CreateWindowsShortcut(desktopPath, exePath, targetDir, iconPath, "OMNIVERSE - Boundless Streams");
                }

                if (chkStartMenu.Checked)
                {
                    string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft", "Windows", "Start Menu", "Programs");
                    string startLnk = Path.Combine(startMenu, "OMNIVERSE.lnk");
                    CreateWindowsShortcut(startLnk, exePath, targetDir, iconPath, "OMNIVERSE - Boundless Streams");
                }

                // Finished!
                Thread.Sleep(300);
                UpdateProgress(100, "Manifestation Complete.", "All streams aligned within one luminous space.");

                this.Invoke((MethodInvoker)delegate
                {
                    isFinished = true;
                    btnAction.Text = "Launch OMNIVERSE";
                    btnAction.Enabled = true;
                    btnAction.BackColor = Color.FromArgb(255, 244, 214);
                });
            }
            catch (Exception ex)
            {
                this.Invoke((MethodInvoker)delegate
                {
                    lblPhase.Text = "Manifestation Interrupted";
                    lblPhase.ForeColor = Color.FromArgb(255, 120, 120);
                    lblDetail.Text = ex.Message;
                    btnAction.Text = "Close";
                    btnAction.Enabled = true;
                    btnAction.Click += (s, e) => Application.Exit();
                });
            }
        }

        private void UpdateProgress(int pct, string phase, string detail)
        {
            if (this.IsDisposed || !this.IsHandleCreated) return;
            this.BeginInvoke((MethodInvoker)delegate
            {
                progressPercent = pct;
                currentPhaseText = phase;
                currentDetailText = detail;
                lblPhase.Text = phase;
                lblDetail.Text = detail;
                cardPanel.Invalidate();
            });
        }

        private void CreateWindowsShortcut(string shortcutPath, string targetExe, string workDir, string iconPath, string desc)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                object shell = Activator.CreateInstance(shellType);
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Type scType = shortcut.GetType();

                scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
                scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workDir });
                if (File.Exists(iconPath))
                {
                    scType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { iconPath + ", 0" });
                }
                scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { desc });
                scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch { }
        }

        private void LaunchInstalledApp()
        {
            try
            {
                string targetExe = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Programs",
                    "Omniverse",
                    "OMNIVERSE.exe"
                );
                if (File.Exists(targetExe))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetExe,
                        WorkingDirectory = Path.GetDirectoryName(targetExe),
                        UseShellExecute = true
                    });
                }
            }
            catch { }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
