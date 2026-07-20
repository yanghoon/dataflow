package io.slim.ingestion.batch.job.step.s3;

import java.util.Map;

public class SourceConfig {
    
    String type;

    // for File
    // String path;

    // for HTTP
    String url;
    String method = "GET";
    Map<String, String> headers = Map.of();
    Object body;

    public String getType() { return type; }
    public String getUrl() { return url; }
    public String getMethod() { return method; }
    public Map<String, String> getHeaders() { return headers; }
    public Object getBody() { return body; }

    public void setType(String type) { this.type = type; }
    public void setUrl(String url) { this.url = url; }
    public void setMethod(String method) { this.method = method; }
    public void setHeaders(Map<String, String> headers) { this.headers = headers; }
    public void setBody(Object body) { this.body = body; }

}
