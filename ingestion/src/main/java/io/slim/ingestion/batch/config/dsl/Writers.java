package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.infrastructure.item.ItemWriter;
import java.util.List;
import java.util.function.Consumer;

public class Writers {
    public static <T> ItemWriter<T> of(Consumer<List<? extends T>> consumer) {
        return chunk -> consumer.accept(chunk.getItems());
    }
}
