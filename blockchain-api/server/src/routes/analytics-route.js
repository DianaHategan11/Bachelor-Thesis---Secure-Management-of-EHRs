const express = require("express");
const authenticate = require("../middleware/auth-middleware");
const authorizeDoctor = require("../middleware/authorize-doctor");

const router = express.Router();

router.get(
  "/analytics/clusters",
  authenticate,
  authorizeDoctor,
  async (req, res) => {
    res.json({
      ageGroups: "/plots/age_groups_by_cluster.png",
      topConditions: "/plots/top_conditions_by_cluster.png",
      totalHospitalizations: "/plots/total_nb_of_hospitalizations.png",
    });
  }
);

module.exports = router;
