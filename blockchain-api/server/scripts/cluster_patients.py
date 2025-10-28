import json
import pandas as pd
from collections import Counter
from matplotlib import  colormaps
from sqlalchemy import create_engine
from sklearn.preprocessing import StandardScaler, MultiLabelBinarizer
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_samples, silhouette_score, davies_bouldin_score
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import matplotlib.cm as cm
import numpy as np
import math

DB_USER = "root"
DB_PASSWORD = "Dienuk11"
DB_HOST = "localhost"
DB_PORT = "3306"
DB_NAME = "licenta-dsrl"

N_CLUSTERS = 6

def get_engine():
    url = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(url, echo=False)

def fetch_all_patient_features() -> pd.DataFrame:
    engine = get_engine()
    query = """
        SELECT
          patient_addr,
          age,
          num_encounters,
          num_amb_encounters,
          num_emer_encounters,
          num_inp_encounters,
          num_procedures,
          top_conditions
        FROM patient_features
    """
    return pd.read_sql(query, engine)

def parse_conditions(json_str: str) -> list[str]:
    try:
        arr = json.loads(json_str)
        if isinstance(arr, list):
            return arr
    except:
        pass
    return []

def prepare_features(df: pd.DataFrame):
    cont_cols = [
        "age",
        "num_encounters",
        "num_inp_encounters",
        "num_emer_encounters",
    ]
    features_df = df[["patient_addr"] + cont_cols].copy()
    return features_df, cont_cols

def find_best_k(X, k_min=2, k_max=20):
    n_samples = X.shape[0]
    if n_samples < k_min:
        print(f"Not enough samples for choosing the best K.")
        return [], [], [], []
    k_max = min(k_max, n_samples)
    wcss, sil_scores, db_scores = [], [], []
    Ks = range(k_min, k_max+1)
    for k in Ks:
        km = KMeans(n_clusters=k, random_state=42).fit(X)
        wcss.append(km.inertia_)
        sil_scores.append(silhouette_score(X, km.labels_) if k > 1 else np.nan)
        db_scores.append(davies_bouldin_score(X, km.labels_) if k > 1 else np.nan)

    plt.figure(figsize=(6,4))
    plt.plot(Ks, wcss, "-o")
    plt.xticks(Ks)
    plt.title("Elbow Method (WCSS vs. K)")
    plt.xlabel("Number of clusters K")
    plt.ylabel("WCSS (Inertia)")
    plt.tight_layout()
    plt.savefig("../plots/elbow_curve.png", dpi=150)
    plt.close()

    plt.figure(figsize=(6,4))
    plt.plot(Ks, sil_scores, "-o")
    plt.xticks(Ks)
    plt.title("Silhouette Score vs. K")
    plt.xlabel("Number of clusters K")
    plt.ylabel("Mean silhouette score")
    plt.tight_layout()
    plt.savefig("../plots/silhouette_scores.png", dpi=150)
    plt.close()
    
    plt.figure(figsize=(6,4))
    plt.plot(Ks, db_scores, "-o", label="Davies-Bouldin")
    plt.xticks(Ks)
    plt.title("Davies-Bouldin Index vs. K")
    plt.xlabel("Number of clusters K")
    plt.ylabel("Davies-Bouldin Index")
    plt.tight_layout()
    plt.savefig("../plots/db_index.png", dpi=150)
    plt.close()

    # return Ks, wcss, sil_scores, db_scores
    best_k = Ks[int(np.nanargmax(sil_scores))]
    return best_k

def plot_silhouette_analysis(X, n_clusters):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12,5))
    fig.suptitle(f"Silhouette analysis for K = {n_clusters}", fontsize=14)

    km = KMeans(n_clusters=n_clusters, random_state=42)
    labels = km.fit_predict(X)
    sil_avg = silhouette_score(X, labels)
    sil_vals = silhouette_samples(X, labels)

    cmap = colormaps["tab10" if n_clusters <= 10 else "tab20"].resampled(n_clusters)
    colors = [cmap(i) for i in range(n_clusters)]

    ax1.set_xlim([-0.1, 1])
    ax1.set_ylim([0, len(X) + (n_clusters+1)*10])
    y_lower = 10
    for i, color in enumerate(colors):
        ith = np.sort(sil_vals[labels == i])
        size_i = ith.shape[0]
        y_upper = y_lower + size_i
        # color = cm.nipy_spectral(float(i)/n_clusters)
        ax1.fill_betweenx(np.arange(y_lower, y_upper), 0, ith,
                          facecolor=color, edgecolor=color, alpha=0.7)
        ax1.text(-0.05, y_lower + 0.5*size_i, str(i+1))
        y_lower = y_upper + 10
    ax1.set_title("Silhouette plot")
    ax1.set_xlabel("Silhouette coefficient values")
    ax1.set_ylabel("Cluster label")
    ax1.axvline(x=sil_avg, color="red", linestyle="--")
    ax1.set_yticks([])

    pca = PCA(n_components=2, random_state=42)
    X_pca = pca.fit_transform(X)
    ax2.set_title("PCA projection of all features")
    ax2.set_xlabel("PC1")
    ax2.set_ylabel("PC2")
    for i, color in enumerate(colors):
        pts = X_pca[labels==i]
        ax2.scatter(pts[:,0], pts[:,1], s=30,
                    # c=[cm.nipy_spectral(float(i)/n_clusters)],
                    c=[color],
                    label=f"Cluster {i+1}", alpha=0.6, edgecolor="k")
    ax2.legend(loc="best")

    plt.tight_layout()
    plt.savefig(f"../plots/silhouette_K{n_clusters}.png", dpi=150)
    plt.close()

def cluster_all_patients(n_clusters):
    raw_df = fetch_all_patient_features()
    if raw_df.empty:
        print("No data to cluster.")
        return raw_df

    features_df, cont_cols = prepare_features(raw_df)

    for col in ["num_encounters", "num_inp_encounters", "num_emer_encounters"]:
        features_df[col] = np.log1p(features_df[col])

    raw_df["parsed_conditions"] = raw_df["top_conditions"].apply(parse_conditions)

    all_conds = Counter(cond for row in raw_df["parsed_conditions"] for cond in row)
    top10 = [c for c,_ in all_conds.most_common(3)]
    raw_df["parsed_conditions"] = raw_df["parsed_conditions"].apply(lambda lst: [c for c in lst if c in top10]) 

    mlb = MultiLabelBinarizer()
    cond_matrix = mlb.fit_transform(raw_df["parsed_conditions"])
    cond_df = pd.DataFrame(
        cond_matrix,
        columns=[f"cond_{c}" for c in mlb.classes_],
        index=raw_df.index
    )

    feat = features_df.set_index(raw_df.index, drop=False)[cont_cols].copy()
    feat = pd.concat([feat, cond_df], axis=1)

    scaler = StandardScaler()
    feat[cont_cols] = scaler.fit_transform(feat[cont_cols])
    X = feat.values

    n_samples = X.shape[0]
    if n_samples < 2:
        print(f"Only ({n_samples}) sample(s) available; skipping clustering.")
        return raw_df
    
    k_use = min(n_clusters, n_samples)

    find_best_k(X, 2, min(20, n_samples))
    if n_samples >= k_use:
        plot_silhouette_analysis(X, k_use)

    km = KMeans(n_clusters=k_use, random_state=42).fit(X)
    features_df["cluster"] = km.labels_

    all_labeled = raw_df.merge(
        features_df[["patient_addr","cluster"]],
        on="patient_addr"
    )

    age_bins   = [0, 20, 40, 60, 80, 120]
    age_labels = ["0-19", "20-39", "40-59", "60-79", "80+"]
    all_labeled["age_group"] = pd.cut(
        all_labeled["age"],
        bins=age_bins,
        labels=age_labels,
        right=False
    )

    count_by_age = (
        all_labeled
        .groupby(["cluster", "age_group"], observed=True)
        .size()
        .unstack(fill_value=0)
    )
    count_by_age.index = count_by_age.index + 1

    ax = count_by_age.plot(
        kind="bar",
        stacked=True,
        figsize=(8, 6),
        title="Age Distribution Among Clusters"
    )
    ax.set_xlabel("Cluster")
    ax.set_ylabel("Number of Patients")

    n = count_by_age.shape[0]
    ax.set_xticks(list(range(n)))
    ax.set_xticklabels([str(i+1) for i in range(n)], rotation=90, ha="center")
    ax.legend(title="Age Group", bbox_to_anchor=(1.02, 1), loc="upper left")

    plt.tight_layout()
    plt.savefig("../plots/age_groups_by_cluster.png", dpi=150)
    plt.close()

    all_labeled["parsed_conditions"] = all_labeled["top_conditions"].apply(parse_conditions)
    
    exploded = (
        all_labeled[["cluster", "parsed_conditions"]]
        .explode("parsed_conditions")
        .rename(columns={"parsed_conditions": "condition"})
        .dropna(subset=["condition"])
    )
    cluster_condition_counts = (
        exploded
        .groupby(["cluster", "condition"])
        .size()
        .reset_index(name="count")
    )

    top_n = 10
    top_conditions_per_cluster = (
        cluster_condition_counts
        .sort_values(["cluster", "count"], ascending=[True, False])
        .groupby("cluster")
        .head(top_n)
        .reset_index(drop=True)
    )

    clusters = sorted(top_conditions_per_cluster["cluster"].unique())
    len_clusters = len(clusters)

    if len_clusters > 6:
        cols = 2
    else:
        cols = 1
    rows = math.ceil(n / cols)

    fig, axes = plt.subplots(
        nrows=rows,
        ncols=cols,
        figsize=(cols * 6, rows * 3),
        sharex=False
    )

    axes = axes.flatten() if hasattr(axes, "__iter__") else [axes]

    for ax, cl in zip(axes, clusters):
        subset = (
            top_conditions_per_cluster
            .query("cluster == @cl")
            .sort_values("count", ascending=True)
        )
        ax.barh(
            subset["condition"],
            subset["count"],
            color=f"C{cl}"
        )
        ax.set_title(f"Top {top_n} Conditions in Cluster {cl+1}")
        ax.set_xlabel("Number of Patients")
        step = 10
        ax.xaxis.set_major_locator(ticker.MultipleLocator(step))
        ax.xaxis.set_major_formatter(ticker.StrMethodFormatter("{x:.0f}"))

    for ax in axes[n:]:
        ax.set_visible(False)

    plt.tight_layout()
    plt.savefig("../plots/top_conditions_by_cluster.png", dpi=150)
    plt.close()

    total_inp  = all_labeled.groupby("cluster")["num_inp_encounters"].sum().reset_index()
    total_emer = all_labeled.groupby("cluster")["num_emer_encounters"].sum().reset_index()

    plt.figure(figsize=(8, 5))
    width   = 0.35
    clusters = total_inp["cluster"].astype(int)

    plt.bar(clusters - width/2, total_inp["num_inp_encounters"], width=width, label="Inpatient (total)")
    plt.bar(clusters + width/2, total_emer["num_emer_encounters"], width=width, label="Emergency (total)")

    plt.title("Total Number of Hospitalizations by Cluster")
    plt.xlabel("Cluster")
    plt.ylabel("Total Number of Encounters")
    plt.xticks(clusters, [str(c+1) for c in clusters])
    plt.legend()
    plt.tight_layout()
    plt.savefig("../plots/total_nb_of_hospitalizations.png", dpi=150)
    plt.close()

    return raw_df

if __name__ == "__main__":
    print(">>> Running global clustering")
    clustered_all = cluster_all_patients(N_CLUSTERS)