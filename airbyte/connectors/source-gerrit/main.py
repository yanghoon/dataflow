import sys
from airbyte_cdk.entrypoint import launch
from source_gerrit.source import SourceGerrit

if __name__ == "__main__":
    source = SourceGerrit()
    launch(source, sys.argv[1:])
