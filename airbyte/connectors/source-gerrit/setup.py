from setuptools import find_packages, setup

setup(
    name="source_gerrit",
    version="0.0.1",
    description="Airbyte Source for Gerrit",
    packages=find_packages(),
    install_requires=[
        "airbyte-cdk",
        "requests",
    ],
    package_data={"": ["spec.json"]},
)
