// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MedicalRecord is Ownable {
    struct Record {
        address patient;
        address doctor;
        string ipfsCid;
        bytes32 recordHash;
        uint256 timestamp;
    }

    Record[] public records;

    mapping(address => uint256[]) private patientRecords;
    mapping(address => mapping(address => bool)) public recordsAccess;

    mapping(address => bool) isPatient;
    mapping(address => bool) isDoctor;

    event RecordCreated(
        uint256 indexed recordId,
        address indexed doctor,
        uint256 indexed timestamp
    );
    event RecordUpdated(
        uint256 indexed recordId,
        string indexed newIpfsCid,
        uint256 indexed timestamp
    );

    event DoctorRegistered(address indexed doctor);
    event PatientRegistered(address indexed patient);

    event AccessGranted(address indexed patient, address indexed grantedTo);
    event AccessRevoked(address indexed patient, address indexed revokedFrom);

    modifier validRecordId(uint256 _recordId) {
        require(
            _recordId > 0 && _recordId < records.length,
            "Invalid record ID"
        );
        _;
    }

    modifier onlyDoctor() {
        require(isDoctor[msg.sender], "Caller is not a doctor");
        _;
    }

    modifier onlyPatient() {
        require(isPatient[msg.sender], "Caller is not a patient");
        _;
    }

    modifier onlyAuthorized(uint256 _recordId) {
        address patient = records[_recordId].patient;
        address doctor = records[_recordId].doctor;
        require(
            patient == msg.sender ||
                doctor == msg.sender ||
                recordsAccess[patient][msg.sender],
            "Access denied"
        );
        _;
    }

    constructor() Ownable(msg.sender) {
        records.push(
            Record({
                patient: address(0),
                doctor: address(0),
                ipfsCid: "",
                recordHash: bytes32(0),
                timestamp: 0
            })
        );
    }

    function registerDoctor(address _doctor) external onlyOwner {
        isDoctor[_doctor] = true;
        emit DoctorRegistered(_doctor);
    }

    function registerPatient(address _patient) external onlyOwner {
        isPatient[_patient] = true;
        emit PatientRegistered(_patient);
    }

    function addRecord(
        address _patient,
        string calldata _ipfsCid,
        bytes32 _recordHash
    ) external onlyDoctor {
        require(isPatient[_patient], "Unknown patient");

        Record memory record = Record({
            patient: _patient,
            doctor: msg.sender,
            ipfsCid: _ipfsCid,
            recordHash: _recordHash,
            timestamp: block.timestamp
        });
        records.push(record);

        uint256 recordId = records.length - 1;
        recordsAccess[_patient][msg.sender] = true;
        patientRecords[_patient].push(recordId);
        emit RecordCreated(recordId, record.doctor, record.timestamp);
    }

    function updateRecord(
        uint256 _recordId,
        string calldata _newIpfsCid,
        bytes32 _newRecordHash
    ) external onlyDoctor validRecordId(_recordId) {
        Record storage record = records[_recordId];
        require(
            record.doctor == msg.sender,
            "Only the doctor that created the record is allowed to update it"
        );

        record.ipfsCid = _newIpfsCid;
        record.recordHash = _newRecordHash;
        record.timestamp = block.timestamp;
        emit RecordUpdated(_recordId, record.ipfsCid, record.timestamp);
    }

    function grantAccess(address _doctor) external onlyPatient {
        require(isDoctor[_doctor], "Target is not a doctor");
        recordsAccess[msg.sender][_doctor] = true;
        emit AccessGranted(msg.sender, _doctor);
    }

    function revokeAccess(address _doctor) external onlyPatient {
        require(isDoctor[_doctor], "Target is not a doctor");
        recordsAccess[msg.sender][_doctor] = false;
        emit AccessRevoked(msg.sender, _doctor);
    }

    function canView(
        uint256 _recordId
    ) public view validRecordId(_recordId) returns (bool) {
        address patient = records[_recordId].patient;
        address doctor = records[_recordId].doctor;
        return
            patient == msg.sender ||
            doctor == msg.sender ||
            recordsAccess[patient][msg.sender];
    }

    function getRecord(
        uint _recordId
    )
        external
        view
        onlyAuthorized(_recordId)
        validRecordId(_recordId)
        returns (Record memory)
    {
        return records[_recordId];
    }

    function getPersonalRecords()
        external
        view
        onlyPatient
        returns (uint256[] memory)
    {
        return patientRecords[msg.sender];
    }
}
