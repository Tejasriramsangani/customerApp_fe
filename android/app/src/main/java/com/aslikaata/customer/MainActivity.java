package com.aslikaata.customer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Override the auto-loaded plugin before the bridge is created.
        initialPlugins.add(SafePushNotificationsPlugin.class);
        initialPlugins.add(LocationAccessPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
