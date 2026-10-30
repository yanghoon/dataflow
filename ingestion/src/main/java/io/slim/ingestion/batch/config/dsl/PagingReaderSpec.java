package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.infrastructure.item.database.JdbcPagingItemReader;
import org.springframework.batch.infrastructure.item.database.PagingQueryProvider;
import org.springframework.batch.infrastructure.item.database.builder.JdbcPagingItemReaderBuilder;
import org.springframework.jdbc.core.RowMapper;
import javax.sql.DataSource;

public class PagingReaderSpec<T, P> implements ReaderSpec<T, PagingReaderSpec<T, P>> {
    private final P parent;
    private final java.util.function.Consumer<PagingReaderSpec<T, P>> applier;
    private final JdbcPagingItemReaderBuilder<T> builder = new JdbcPagingItemReaderBuilder<>();
    private boolean saveStateExplicitlySet = false;
    private boolean saveState = true;

    public PagingReaderSpec(P parent, java.util.function.Consumer<PagingReaderSpec<T, P>> applier) {
        this.parent = parent;
        this.applier = applier;
    }

    public PagingReaderSpec<T, P> name(String name) { builder.name(name); return this; }
    public PagingReaderSpec<T, P> dataSource(DataSource ds) { builder.dataSource(ds); return this; }
    public PagingReaderSpec<T, P> queryProvider(PagingQueryProvider qp) { builder.queryProvider(qp); return this; }
    public PagingReaderSpec<T, P> pageSize(int size) { builder.pageSize(size); return this; }
    public PagingReaderSpec<T, P> rowMapper(RowMapper<T> rowMapper) { builder.rowMapper(rowMapper); return this; }
    public PagingReaderSpec<T, P> saveState(boolean saveState) { 
        builder.saveState(saveState); 
        this.saveState = saveState;
        this.saveStateExplicitlySet = true;
        return this; 
    }

    public boolean isSaveStateExplicitlySet() { return saveStateExplicitlySet; }
    public boolean getSaveState() { return saveState; }

    @Override
    public PagingReaderSpec<T, P> configure(java.util.function.Consumer<PagingReaderSpec<T, P>> configurer) {
        configurer.accept(this);
        return this;
    }

    @Override
    public JdbcPagingItemReader<T> raw() {
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
