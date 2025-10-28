import React, { useEffect, useState } from "react";
import axiosInstance from "../api";

export default function ClusterStats() {
  const [urls, setUrls] = useState(null);

  useEffect(() => {
    axiosInstance
      .get("/analytics/clusters")
      .then((res) => setUrls(res.data))
      .catch(console.error);
  }, []);

  if (!urls) return <p>Loading analysis…</p>;

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>
        Cluster Analysis - based on patients' age, number of encounters and most
        frequent conditions
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <section>
            <h3 style={{ margin: "0.5rem 0", textAlign: "center" }}>
              Age Distribution Among Clusters
            </h3>
            <img
              src={urls.ageGroups}
              alt="Age groups by cluster"
              style={{ width: "100%", height: "50vh", objectFit: "contain" }}
            />
          </section>

          <section>
            <h3 style={{ margin: "0.5rem 0", textAlign: "center" }}>
              Total Number of Hospitalizations <br />
              by Cluster
            </h3>
            <img
              src={urls.totalHospitalizations}
              alt="Total number of hospitalizations by cluster"
              style={{ width: "100%", height: "50vh", objectFit: "contain" }}
            />
          </section>
        </div>

        <section>
          <h3 style={{ margin: "0.5rem 0", textAlign: "center" }}>
            Top 10 Conditions <br />
            in each Cluster
          </h3>
          <img
            src={urls.topConditions}
            alt="Top conditions by cluster"
            style={{ width: "100%", height: "103vh", objectFit: "contain" }}
          />
        </section>
      </div>
    </div>
  );
}
