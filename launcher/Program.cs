using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace OmniverseStandalone
{
    static class Program
    {
        static bool IsPortListening(int port)
        {
            try
            {
                using (var tcp = new TcpClient())
                {
                    var ar = tcp.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = ar.AsyncWaitHandle.WaitOne(120);
                    if (!ok) return false;
                    tcp.EndConnect(ar);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        [STAThread]
        static void Main()
        {
            Process serverProcess = null;
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installedDir = Path.Combine(localAppData, "Programs", "Omniverse");
                string devDir = @"C:\Users\PRAPTI\Downloads\yt-download";

                string projectDir = null;
                if (File.Exists(Path.Combine(baseDir, "desktop", "server.js")))
                {
                    projectDir = baseDir;
                }
                else if (File.Exists(Path.Combine(installedDir, "desktop", "server.js")))
                {
                    projectDir = installedDir;
                }
                else if (File.Exists(Path.Combine(devDir, "desktop", "server.js")))
                {
                    projectDir = devDir;
                }
                else
                {
                    MessageBox.Show(
                        "Could not locate the OMNIVERSE application files.\n\n" +
                        "Looked in:\n" +
                        "• Portable: " + baseDir + "\n" +
                        "• Installed: " + installedDir + "\n\n" +
                        "Please run the installer or keep the 'desktop' folder alongside OMNIVERSE.exe.",
                        "OMNIVERSE",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                string serverScript = Path.Combine(projectDir, "desktop", "server.js");
                int port = 39428;
                string appUrl = "http://127.0.0.1:" + port;

                // Detect node.exe executable path (prioritize bundled bin\node.exe for zero dependencies)
                string nodePath = "node";
                string bundledNode1 = Path.Combine(projectDir, "bin", "node.exe");
                string bundledNode2 = Path.Combine(baseDir, "bin", "node.exe");
                string pfNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");

                if (File.Exists(bundledNode1))
                {
                    nodePath = bundledNode1;
                }
                else if (File.Exists(bundledNode2))
                {
                    nodePath = bundledNode2;
                }
                else if (File.Exists(pfNode))
                {
                    nodePath = pfNode;
                }

                // 1. Check if server is already running on port 39428
                bool isReady = IsPortListening(port);

                if (!isReady)
                {
                    // Start Standalone Background Server
                    ProcessStartInfo serverInfo = new ProcessStartInfo
                    {
                        FileName = nodePath,
                        Arguments = "\"" + serverScript + "\"",
                        WorkingDirectory = projectDir,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        UseShellExecute = false,
                        RedirectStandardError = true
                    };

                    serverProcess = Process.Start(serverInfo);

                    // 2. Poll server until active (up to 8 seconds, 100ms intervals)
                    for (int attempt = 0; attempt < 80; attempt++)
                    {
                        if (IsPortListening(port))
                        {
                            isReady = true;
                            break;
                        }

                        if (serverProcess != null && serverProcess.HasExited)
                        {
                            string errText = serverProcess.StandardError.ReadToEnd();
                            MessageBox.Show(
                                "The local OMNIVERSE engine exited unexpectedly:\n\n" +
                                (string.IsNullOrEmpty(errText) ? "Process exit code: " + serverProcess.ExitCode : errText),
                                "OMNIVERSE",
                                MessageBoxButtons.OK,
                                MessageBoxIcon.Error
                            );
                            return;
                        }

                        Thread.Sleep(100);
                    }
                }

                if (!isReady)
                {
                    MessageBox.Show(
                        "The local OMNIVERSE engine could not bind to port " + port + ".\n\n" +
                        "Please check if another application is blocking port " + port + ".",
                        "OMNIVERSE",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                // 3. Launch Dedicated Native Desktop Application Window (Frameless App Mode)
                string edgePath1 = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                string edgePath2 = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                string browserPath = null;

                if (File.Exists(edgePath1)) browserPath = edgePath1;
                else if (File.Exists(edgePath2)) browserPath = edgePath2;
                else if (File.Exists(chromePath)) browserPath = chromePath;

                Process appWindowProcess = null;

                if (browserPath != null)
                {
                    string profileDir = Path.Combine(Path.GetTempPath(), "omniverse_desktop_profile");
                    ProcessStartInfo appWinInfo = new ProcessStartInfo
                    {
                        FileName = browserPath,
                        Arguments = "--app=\"" + appUrl + "\" --window-size=1150,820 --user-data-dir=\"" + profileDir + "\"",
                        UseShellExecute = false
                    };
                    appWindowProcess = Process.Start(appWinInfo);
                }
                else
                {
                    // Fallback to default browser
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = appUrl,
                        UseShellExecute = true
                    });
                }

                // 4. Wait for user to close the app window, then terminate background server cleanly
                if (appWindowProcess != null)
                {
                    appWindowProcess.WaitForExit();
                }
                else
                {
                    Thread.Sleep(1000);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Unable to launch OMNIVERSE Standalone:\n\n" + ex.Message,
                    "OMNIVERSE",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            }
            finally
            {
                // Clean shutdown of server process if we started it
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    try
                    {
                        serverProcess.Kill();
                    }
                    catch { }
                }
            }
        }
    }
}
