package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.infrastructure.item.ItemReader;

public interface ReaderSpec<T, R extends ReaderSpec<T, R>> {
    R configure(java.util.function.Consumer<R> configurer);
    ItemReader<T> raw();
}
