package com.sreyoun.meatball;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.RemoteException;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.HttpURLConnection;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import woyou.aidlservice.jiuiv5.IWoyouService;

@CapacitorPlugin(name = "SreyounPrint")
public class SreyounPrintPlugin extends Plugin {
    private static final int ALIGN_LEFT = 0;
    private static final int ALIGN_CENTER = 1;
    private static final int PAPER_WIDTH_CHARS = 32;
    private static final int MAX_BIND_WAIT_ATTEMPTS = 10;
    private static final int BIND_WAIT_DELAY_MS = 250;
    private static final int WIFI_SYNC_PORT = 8787;

    private IWoyouService sunmiService;
    private boolean sunmiBindingStarted = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ServerSocket wifiSyncServerSocket;
    private Thread wifiSyncServerThread;
    private volatile boolean wifiSyncRunning = false;
    private int wifiSyncPort = WIFI_SYNC_PORT;

    private final ServiceConnection sunmiConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            sunmiService = IWoyouService.Stub.asInterface(service);
            sunmiBindingStarted = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            sunmiService = null;
            sunmiBindingStarted = false;
        }
    };

    @Override
    public void load() {
        bindSunmiPrinterService();
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (sunmiBindingStarted) {
                getContext().unbindService(sunmiConnection);
            }
        } catch (Exception ignored) {
        }
        stopWifiSyncServer();
        sunmiService = null;
        sunmiBindingStarted = false;
    }

    @PluginMethod
    public void printSunmiReceipt(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            json = call.getString("invoiceJson");
        }

        if (json == null || json.trim().isEmpty()) {
            call.reject("Missing receipt JSON");
            return;
        }

        printSunmiReceiptWhenReady(call, json, 0);
    }

    private void printSunmiReceiptWhenReady(PluginCall call, String json, int attempt) {
        try {
            if (sunmiService != null) {
                JSONObject data = new JSONObject(json);
                printReceiptText(data);
                call.resolve();
                return;
            }

            bindSunmiPrinterService();

            if (attempt >= MAX_BIND_WAIT_ATTEMPTS) {
                call.reject("SUNMI printer service is not connected. Check the paper and restart the SUNMI printer service.");
                return;
            }

            mainHandler.postDelayed(
                () -> printSunmiReceiptWhenReady(call, json, attempt + 1),
                BIND_WAIT_DELAY_MS
            );
        } catch (Exception error) {
            call.reject("SUNMI print error: " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        String title = call.getString("title", "SREYOUN MEATBALL Invoice");

        if (html == null || html.trim().isEmpty()) {
            call.reject("Missing invoice HTML");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView printWebView = new WebView(getContext());
            printWebView.getSettings().setDefaultTextEncodingName("utf-8");
            printWebView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    PrintManager printManager =
                        (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);

                    if (printManager == null) {
                        call.reject("Android print service is unavailable");
                        return;
                    }

                    PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setResolution(
                            new PrintAttributes.Resolution("sreyoun", "SREYOUN", 300, 300)
                        )
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();

                    printManager.print(title, view.createPrintDocumentAdapter(title), attributes);
                    call.resolve();
                }
            });
            printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    @PluginMethod
    public void saveImageToPictures(PluginCall call) {
        String base64 = call.getString("base64");
        String fileName = call.getString("fileName", "invoice.png");

        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("Missing image data");
            return;
        }

        try {
            byte[] imageBytes = Base64.decode(stripBase64Header(base64), Base64.DEFAULT);
            Uri savedUri = savePngToPictures(imageBytes, fileName);
            JSObject result = new JSObject();
            result.put("uri", savedUri.toString());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not save receipt photo: " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void startWifiSyncReceiver(PluginCall call) {
        Integer requestedPort = call.getInt("port");
        int port = requestedPort == null ? WIFI_SYNC_PORT : requestedPort;

        try {
            if (!wifiSyncRunning) {
                startWifiSyncServer(port);
            }
            call.resolve(wifiSyncStatus());
        } catch (Exception error) {
            call.reject("Could not start WiFi sync receiver: " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void stopWifiSyncReceiver(PluginCall call) {
        stopWifiSyncServer();
        call.resolve(wifiSyncStatus());
    }

    @PluginMethod
    public void getWifiSyncStatus(PluginCall call) {
        call.resolve(wifiSyncStatus());
    }

    @PluginMethod
    public void testWifiSync(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Missing receiver URL");
            return;
        }

        new Thread(() -> {
            try {
                HttpResult result = requestWifiSync(url, "GET", "/ping", null);
                JSObject response = new JSObject();
                response.put("ok", result.statusCode >= 200 && result.statusCode < 300);
                response.put("status", result.statusCode);
                response.put("body", result.body);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Could not reach WiFi receiver: " + error.getMessage(), error);
            }
        }, "SreyounWifiSyncTest").start();
    }

    @PluginMethod
    public void sendWifiSync(PluginCall call) {
        String url = call.getString("url");
        String json = call.getString("json");

        if (url == null || url.trim().isEmpty()) {
            call.reject("Missing receiver URL");
            return;
        }

        if (json == null || json.trim().isEmpty()) {
            call.reject("Missing sync payload");
            return;
        }

        new Thread(() -> {
            try {
                HttpResult result = requestWifiSync(url, "POST", "/sync", json);
                if (result.statusCode < 200 || result.statusCode >= 300) {
                    call.reject("WiFi receiver returned " + result.statusCode);
                    return;
                }

                JSObject response = new JSObject();
                response.put("ok", true);
                response.put("status", result.statusCode);
                response.put("body", result.body);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Could not send WiFi sync: " + error.getMessage(), error);
            }
        }, "SreyounWifiSyncSend").start();
    }

    private void bindSunmiPrinterService() {
        if (getContext() == null || sunmiBindingStarted) {
            return;
        }

        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            sunmiBindingStarted = getContext().bindService(intent, sunmiConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception error) {
            sunmiBindingStarted = false;
            Toast.makeText(getContext(), "SUNMI printer service not found", Toast.LENGTH_LONG).show();
        }
    }

    private Uri savePngToPictures(byte[] bytes, String fileName) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, sanitizeFileName(fileName));
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(
                MediaStore.Images.Media.RELATIVE_PATH,
                Environment.DIRECTORY_PICTURES + "/SREYOUN MEATBALL"
            );
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }

        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("Android media storage is unavailable");
        }

        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) {
                throw new IOException("Could not open image output");
            }
            output.write(bytes);
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            throw error;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues completeValues = new ContentValues();
            completeValues.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, completeValues, null, null);
        }

        return uri;
    }

    private String stripBase64Header(String value) {
        int commaIndex = value.indexOf(',');
        return commaIndex >= 0 ? value.substring(commaIndex + 1) : value;
    }

    private String sanitizeFileName(String fileName) {
        String cleaned = nonEmpty(fileName, "invoice.png").replaceAll("[\\\\/:*?\"<>|]", "-");
        return cleaned.toLowerCase(Locale.US).endsWith(".png") ? cleaned : cleaned + ".png";
    }

    private void startWifiSyncServer(int port) throws IOException {
        wifiSyncServerSocket = new ServerSocket(port);
        wifiSyncPort = wifiSyncServerSocket.getLocalPort();
        wifiSyncRunning = true;
        wifiSyncServerThread = new Thread(this::runWifiSyncServer, "SreyounWifiSyncServer");
        wifiSyncServerThread.start();
    }

    private void runWifiSyncServer() {
        while (wifiSyncRunning && wifiSyncServerSocket != null && !wifiSyncServerSocket.isClosed()) {
            try {
                Socket socket = wifiSyncServerSocket.accept();
                Thread clientThread = new Thread(
                    () -> handleWifiSyncClient(socket),
                    "SreyounWifiSyncClient"
                );
                clientThread.start();
            } catch (IOException error) {
                if (wifiSyncRunning) {
                    wifiSyncRunning = false;
                }
            }
        }
    }

    private void stopWifiSyncServer() {
        wifiSyncRunning = false;

        if (wifiSyncServerSocket != null) {
            try {
                wifiSyncServerSocket.close();
            } catch (Exception ignored) {
            }
        }

        wifiSyncServerSocket = null;
        wifiSyncServerThread = null;
    }

    private void handleWifiSyncClient(Socket socket) {
        try (Socket client = socket) {
            HttpRequest request = readHttpRequest(client);

            if ("OPTIONS".equals(request.method)) {
                writeHttpResponse(client, 204, "No Content", "text/plain", "");
                return;
            }

            if ("GET".equals(request.method) && ("/".equals(request.path) || "/ping".equals(request.path))) {
                JSONObject status = new JSONObject();
                status.put("ok", true);
                status.put("app", "SREYOUN MEATBALL");
                status.put("sync", "ready");
                writeHttpResponse(client, 200, "OK", "application/json", status.toString());
                return;
            }

            if ("POST".equals(request.method) && "/sync".equals(request.path)) {
                JSONObject payload = new JSONObject(request.body);
                JSObject event = new JSObject();
                event.put("json", payload.toString());
                event.put("source", client.getInetAddress().getHostAddress());
                mainHandler.post(() -> notifyListeners("wifiSyncReceived", event, true));
                writeHttpResponse(client, 200, "OK", "application/json", "{\"ok\":true}");
                return;
            }

            writeHttpResponse(client, 404, "Not Found", "application/json", "{\"ok\":false}");
        } catch (Exception error) {
            try {
                writeHttpResponse(socket, 400, "Bad Request", "application/json", "{\"ok\":false}");
            } catch (Exception ignored) {
            }
        }
    }

    private HttpResult requestWifiSync(
        String baseUrl,
        String method,
        String path,
        String body
    ) throws IOException {
        URL url = new URL(composeWifiSyncUrl(baseUrl, path));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(3500);
        connection.setReadTimeout(5000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "application/json");

        if (body != null) {
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(bodyBytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bodyBytes);
            }
        }

        int statusCode = connection.getResponseCode();
        InputStream responseStream =
            statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String responseBody = responseStream == null ? "" : readStreamToString(responseStream);
        connection.disconnect();

        HttpResult result = new HttpResult();
        result.statusCode = statusCode;
        result.body = responseBody;
        return result;
    }

    private String composeWifiSyncUrl(String baseUrl, String path) {
        String cleaned = baseUrl.trim();
        if (!cleaned.toLowerCase(Locale.US).startsWith("http://") &&
            !cleaned.toLowerCase(Locale.US).startsWith("https://")) {
            cleaned = "http://" + cleaned;
        }

        while (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }

        if (cleaned.endsWith("/sync") || cleaned.endsWith("/ping")) {
            int lastSlash = cleaned.lastIndexOf('/');
            cleaned = cleaned.substring(0, lastSlash);
        }

        return cleaned + path;
    }

    private String readStreamToString(InputStream input) throws IOException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private HttpRequest readHttpRequest(Socket socket) throws IOException {
        InputStream input = socket.getInputStream();
        ByteArrayOutputStream headerBytes = new ByteArrayOutputStream();
        int matched = 0;
        byte[] delimiter = new byte[] { 13, 10, 13, 10 };

        while (true) {
            int next = input.read();
            if (next == -1) {
                throw new IOException("Missing HTTP headers");
            }

            headerBytes.write(next);
            if (next == delimiter[matched]) {
                matched += 1;
                if (matched == delimiter.length) {
                    break;
                }
            } else {
                matched = next == delimiter[0] ? 1 : 0;
            }

            if (headerBytes.size() > 32768) {
                throw new IOException("HTTP headers too large");
            }
        }

        String headerText = headerBytes.toString(StandardCharsets.ISO_8859_1.name());
        String[] lines = headerText.split("\\r?\\n");
        if (lines.length == 0) {
            throw new IOException("Missing request line");
        }

        String[] requestParts = lines[0].split(" ");
        if (requestParts.length < 2) {
            throw new IOException("Invalid request line");
        }

        Map<String, String> headers = new LinkedHashMap<>();
        for (int index = 1; index < lines.length; index += 1) {
            String line = lines[index];
            int separator = line.indexOf(':');
            if (separator > 0) {
                headers.put(
                    line.substring(0, separator).trim().toLowerCase(Locale.US),
                    line.substring(separator + 1).trim()
                );
            }
        }

        int contentLength = 0;
        try {
            contentLength = Integer.parseInt(headers.getOrDefault("content-length", "0"));
        } catch (NumberFormatException ignored) {
        }

        byte[] bodyBytes = readExactBytes(input, contentLength);
        HttpRequest request = new HttpRequest();
        request.method = requestParts[0].toUpperCase(Locale.US);
        request.path = requestParts[1].split("\\?")[0];
        request.body = new String(bodyBytes, StandardCharsets.UTF_8);

        return request;
    }

    private byte[] readExactBytes(InputStream input, int byteCount) throws IOException {
        byte[] bytes = new byte[Math.max(byteCount, 0)];
        int offset = 0;

        while (offset < bytes.length) {
            int read = input.read(bytes, offset, bytes.length - offset);
            if (read == -1) {
                throw new IOException("Incomplete request body");
            }
            offset += read;
        }

        return bytes;
    }

    private void writeHttpResponse(
        Socket socket,
        int statusCode,
        String statusText,
        String contentType,
        String body
    ) throws IOException {
        byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
        String headers =
            "HTTP/1.1 " + statusCode + " " + statusText + "\r\n" +
            "Content-Type: " + contentType + "; charset=utf-8\r\n" +
            "Content-Length: " + bodyBytes.length + "\r\n" +
            "Connection: close\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
            "Access-Control-Allow-Headers: Content-Type\r\n\r\n";
        OutputStream output = socket.getOutputStream();
        output.write(headers.getBytes(StandardCharsets.UTF_8));
        output.write(bodyBytes);
        output.flush();
    }

    private JSObject wifiSyncStatus() {
        String ipAddress = getLocalIpAddress();
        JSObject status = new JSObject();
        status.put("running", wifiSyncRunning);
        status.put("ip", ipAddress);
        status.put("port", wifiSyncPort);
        status.put("url", ipAddress.isEmpty() ? "" : "http://" + ipAddress + ":" + wifiSyncPort);

        return status;
    }

    private String getLocalIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (!networkInterface.isUp() || networkInterface.isLoopback()) {
                    continue;
                }

                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (address instanceof Inet4Address && !address.isLoopbackAddress()) {
                        return address.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }

        return "";
    }

    private static class HttpRequest {
        String method;
        String path;
        String body;
    }

    private static class HttpResult {
        int statusCode;
        String body;
    }

    private void printReceiptText(JSONObject data) throws Exception {
        sunmiService.printerInit(null);
        sunmiService.setFontSize(22, null);

        printCentered(nonEmpty(data.optString("khmerName"), "ស្រីអូន លក់ប្រហិតគ្រប់មុខ"));
        printCentered(nonEmpty(data.optString("shopName"), "SREYOUN MEATBALL"));
        printCentered(nonEmpty(data.optString("shopPhone"), "010 790 913 / 012 913 614"));
        printLine();

        printLeft("Invoice: #" + nonEmpty(data.optString("invoiceNo"), "000000"));
        printLeft("Date: " + data.optString("date") + " " + data.optString("time"));
        printLeft("Type: " + displayPriceType(data.optString("priceType")));
        printLeft("Customer: " + nonEmpty(data.optString("customer"), "Walk-in"));

        String customerPhone = data.optString("customerPhone");
        if (!customerPhone.trim().isEmpty()) {
            printLeft("Phone: " + customerPhone);
        }

        printLine();
        printLeft("Item              Qty    Amount");
        printLine();

        JSONArray items = data.optJSONArray("items");
        if (items != null) {
            for (int index = 0; index < items.length(); index += 1) {
                JSONObject item = items.getJSONObject(index);
                String name = nonEmpty(item.optString("name"), "Item");
                String qty = String.valueOf(item.optInt("qty", 0));
                String amount = money(item.optDouble("amount", 0));
                printItemLine(name, qty, amount);
            }
        }

        printLine();
        printMoneyRow("TOTAL:", data.optDouble("total", 0));
        printMoneyRow("PAID:", data.optDouble("amountPaid", 0));
        printMoneyRow("BALANCE:", data.optDouble("balanceDue", 0));
        printLeft("Payment: " + displayPaymentStatus(data.optString("paymentStatus")));

        String note = data.optString("note");
        if (!note.trim().isEmpty()) {
            printLine();
            printLeft("Note: " + note);
        }

        printLine();
        printCentered("ABA Bank");
        String bank1 = data.optString("bank1");
        if (!bank1.trim().isEmpty()) {
            printCentered(bank1);
        }
        String bank2 = data.optString("bank2");
        if (!bank2.trim().isEmpty()) {
            printCentered(bank2);
        }

        printLeft("");
        printCentered("Thank you!");
        sunmiService.lineWrap(3, null);
    }

    private void printCentered(String text) throws RemoteException {
        sunmiService.setAlignment(ALIGN_CENTER, null);
        sunmiService.printText(text + "\n", null);
    }

    private void printLeft(String text) throws RemoteException {
        sunmiService.setAlignment(ALIGN_LEFT, null);
        sunmiService.printText(text + "\n", null);
    }

    private void printLine() throws RemoteException {
        printLeft("--------------------------------");
    }

    private void printItemLine(String name, String qty, String amount) throws RemoteException {
        String cleanName = name.replace("\n", " ").trim();
        int nameWidth = 17;
        if (visibleLength(cleanName) <= nameWidth) {
            printLeft(padRight(cleanName, nameWidth) + padLeft(qty, 4) + padLeft(amount, 11));
            return;
        }

        String first = safeSubstring(cleanName, 0, nameWidth);
        String rest = cleanName.substring(first.length()).trim();
        printLeft(padRight(first, nameWidth) + padLeft(qty, 4) + padLeft(amount, 11));

        while (!rest.isEmpty()) {
            String part = safeSubstring(rest, 0, PAPER_WIDTH_CHARS);
            printLeft(part);
            rest = rest.substring(part.length()).trim();
        }
    }

    private void printMoneyRow(String label, double value) throws RemoteException {
        printLeft(padRight(label, 12) + padLeft(money(value), 20));
    }

    private String displayPriceType(String priceType) {
        return "wholesale".equals(priceType) ? "Wholesale" : "Retail";
    }

    private String displayPaymentStatus(String paymentStatus) {
        return "paid".equals(paymentStatus) ? "Paid" : "Unpaid";
    }

    private String money(double value) {
        if (value == Math.floor(value)) {
            return "៛" + (long) value;
        }
        return "៛" + String.format(Locale.US, "%.2f", value);
    }

    private String nonEmpty(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String padRight(String value, int width) {
        StringBuilder builder = new StringBuilder(value == null ? "" : value);
        while (visibleLength(builder.toString()) < width) {
            builder.append(' ');
        }
        return builder.toString();
    }

    private String padLeft(String value, int width) {
        StringBuilder builder = new StringBuilder(value == null ? "" : value);
        while (visibleLength(builder.toString()) < width) {
            builder.insert(0, ' ');
        }
        return builder.toString();
    }

    private int visibleLength(String value) {
        return value == null ? 0 : value.length();
    }

    private String safeSubstring(String value, int start, int maxChars) {
        if (value == null || start >= value.length()) {
            return "";
        }
        int end = Math.min(value.length(), start + maxChars);
        return value.substring(start, end);
    }
}
