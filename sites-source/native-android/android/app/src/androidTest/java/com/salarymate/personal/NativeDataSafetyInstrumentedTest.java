package com.salarymate.personal;

import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NativeDataSafetyInstrumentedTest {
 @Test public void isolatedNativeSqliteFaultInjection() throws Exception {
  android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
  Context context=instrumentation.getTargetContext();
  assertEquals("com.salarymate.personal.debug",context.getPackageName());
  File evidence=new File(context.getFilesDir(),"native-fault-result.json");
  try(FileOutputStream out=new FileOutputStream(evidence)){out.write("{\"status\":\"RUNNING\"}".getBytes(StandardCharsets.UTF_8));}
  Intent intent=new Intent(context,MainActivity.class);
  intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
  intent.putExtra("salarymate_native_qa",true);
  MainActivity activity=(MainActivity)instrumentation.startActivitySync(intent);
  try {
   long deadline=System.currentTimeMillis()+180000;
   String value=null;
   while(System.currentTimeMillis()<deadline){
    AtomicReference<String> captured=new AtomicReference<>();CountDownLatch done=new CountDownLatch(1);
    instrumentation.runOnMainSync(()->{
     if(activity.getBridge()==null || activity.getBridge().getWebView()==null){done.countDown();return;}
     activity.getBridge().getWebView().evaluateJavascript("JSON.stringify(window.__SALARYMATE_NATIVE_QA__ || null)",json->{captured.set(json);done.countDown();});
    });
    assertTrue("WebView callback timeout",done.await(10,TimeUnit.SECONDS));
    if(captured.get()!=null){Object decoded=new JSONTokener(captured.get()).nextValue();if(decoded instanceof String && !"null".equals(decoded)){value=(String)decoded;break;}}
    Thread.sleep(400);
   }
   assertNotNull("Native SQLite suite did not complete",value);
   try(FileOutputStream out=new FileOutputStream(evidence)){out.write(value.getBytes(StandardCharsets.UTF_8));}
   JSONObject report=new JSONObject(value);
   assertEquals(10,report.getJSONArray("cases").length());
   for(int i=0;i<10;i++){JSONObject row=report.getJSONArray("cases").getJSONObject(i);assertEquals(row.toString(),"PASS",row.getString("status"));}
   assertEquals("PASS",report.getString("status"));
  } finally {instrumentation.runOnMainSync(activity::finish);}
 }
}
