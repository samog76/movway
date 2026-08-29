package app.movway.tv;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins are not discovered automatically; without this the web
        // layer's calls to "Updater" resolve to nothing.
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
