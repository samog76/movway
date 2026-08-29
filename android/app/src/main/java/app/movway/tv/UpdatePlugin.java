package app.movway.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Updating Movway from inside Movway.
 *
 * Sideloaded builds get no store to update them, so without this the only way
 * to take a new version is to find the download page on another device and
 * install by hand — which on a TV means a keyboard on screen and a browser
 * nobody wants to use.
 *
 * The work here is the part the WebView cannot do: fetch the APK over the
 * platform's own HTTP stack, prove it arrived intact, and hand it to Android's
 * package installer. Deciding whether an update exists is left to the web
 * layer, which is where the version comparison and the UI live.
 */
@CapacitorPlugin(name = "Updater")
public class UpdatePlugin extends Plugin {

    /** Cache rather than files: a half-taken update is rubbish worth losing. */
    private static final String APK_NAME = "movway-update.apk";

    @PluginMethod
    public void currentVersion(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo info = pm.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;

            JSObject result = new JSObject();
            result.put("version", info.versionName);
            result.put("versionCode", code);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read the installed version: " + e.getMessage());
        }
    }

    /**
     * Installing an APK needs a per-app permission the viewer grants in system
     * settings. Asked before downloading, so a refusal costs nothing.
     */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                    .setData(Uri.parse("package:" + getContext().getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the install-permission screen: " + e.getMessage());
        }
    }

    /**
     * Downloads the APK and opens the installer.
     *
     * On its own thread because plugin methods arrive on the main one, and
     * Android kills a main-thread network call outright.
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        final String expected = call.getString("sha256");

        if (url == null || url.isEmpty()) {
            call.reject("No download address given");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                File apk = new File(getContext().getCacheDir(), APK_NAME);
                if (apk.exists() && !apk.delete()) {
                    call.reject("A previous download is in the way and could not be removed");
                    return;
                }

                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.connect();

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("The download site answered " + status);
                    return;
                }

                long total = connection.getContentLength();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");

                try (InputStream in = connection.getInputStream();
                     OutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[16384];
                    long received = 0;
                    int lastPercent = -1;
                    int read;

                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        received += read;

                        // Only on a change, or a slow line would post thousands
                        // of identical events at the web layer.
                        int percent = total > 0 ? (int) (received * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("received", received);
                            progress.put("total", total);
                            notifyListeners("progress", progress);
                        }
                    }
                }

                if (expected != null && !expected.isEmpty()) {
                    StringBuilder hex = new StringBuilder();
                    for (byte b : digest.digest()) hex.append(String.format("%02x", b));
                    if (!hex.toString().equalsIgnoreCase(expected)) {
                        // A truncated or tampered file must never reach the
                        // installer, so it goes rather than sitting in cache.
                        //noinspection ResultOfMethodCallIgnored
                        apk.delete();
                        call.reject("The download did not arrive intact and was discarded");
                        return;
                    }
                }

                Uri uri = FileProvider.getUriForFile(
                        getContext(), getContext().getPackageName() + ".fileprovider", apk);

                Intent install = new Intent(Intent.ACTION_VIEW)
                        .setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                Activity activity = getActivity();
                if (activity != null) activity.startActivity(install);
                else getContext().startActivity(install);

                call.resolve();
            } catch (Exception e) {
                call.reject("Update failed: " + e.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
