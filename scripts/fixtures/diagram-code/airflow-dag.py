from airflow import DAG
from airflow.decorators import task
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import PythonOperator
from airflow.utils.task_group import TaskGroup

with DAG(dag_id="orders_daily", schedule="@daily") as dag:
    start = EmptyOperator(task_id="start")
    extract = PythonOperator(
        task_id="extract_orders",
        python_callable=extract_orders,
    )
    @task()
    def normalize_orders(rows):
        return rows

    normalized = normalize_orders(extract)
    with TaskGroup(group_id="delivery") as delivery:
        publish = EmptyOperator(task_id="publish")

    start >> extract
    extract.set_downstream(publish)
    normalized >> publish
