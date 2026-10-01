package io.slim.batch.console.scheduler;
import com.github.kagkarlsson.scheduler.SchedulerClient;
public class DbSchedulerTest {
    public void test(SchedulerClient client) {
        client.schedule(null, null, null);
    }
}
