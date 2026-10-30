package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.infrastructure.item.database.JdbcCursorItemReader;
import org.springframework.batch.infrastructure.item.database.builder.JdbcCursorItemReaderBuilder;
import org.springframework.jdbc.core.RowMapper;
import javax.sql.DataSource;

public class CursorReaderSpec<T, P> implements ReaderSpec<T, CursorReaderSpec<T, P>> {
    private final P parent;
    private final java.util.function.Consumer<CursorReaderSpec<T, P>> applier;
    private final JdbcCursorItemReaderBuilder<T> builder = new JdbcCursorItemReaderBuilder<>();

    public CursorReaderSpec(P parent, java.util.function.Consumer<CursorReaderSpec<T, P>> applier) {
        this.parent = parent;
        this.applier = applier;
    }

    public CursorReaderSpec<T, P> name(String name) { builder.name(name); return this; }
    public CursorReaderSpec<T, P> dataSource(DataSource ds) { builder.dataSource(ds); return this; }
    public CursorReaderSpec<T, P> sql(String sql) { builder.sql(sql); return this; }
    public CursorReaderSpec<T, P> rowMapper(RowMapper<T> rowMapper) { builder.rowMapper(rowMapper); return this; }
    
    @Override
    public CursorReaderSpec<T, P> configure(java.util.function.Consumer<CursorReaderSpec<T, P>> configurer) {
        configurer.accept(this);
        return this;
    }

    @Override
    public JdbcCursorItemReader<T> raw() { 
        try {
            return builder.build(); 
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public P and() {
        applier.accept(this);
        return parent;
    }
}
