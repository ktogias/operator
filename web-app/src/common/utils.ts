// This file is part of MinIO Operator
// Copyright (c) 2021 MinIO, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import storage from "local-storage-fallback";
import {
  IBytesCalc,
  ICapacity,
  IErasureCodeCalc,
  IStorageDistribution,
  IStorageFactors,
} from "./types";
import {
  IMkEnvs,
  IntegrationConfiguration,
  mkPanelConfigurations,
} from "../screens/Console/Tenants/AddTenant/Steps/TenantResources/utils";
import get from "lodash/get";
import { Pool } from "../api/operatorApi";

const minStReq = 1073741824; // Minimal Space required for MinIO
const minMemReq = 2147483648; // Minimal Memory required for MinIO in bytes

export const units = [
  "B",
  "KiB",
  "MiB",
  "GiB",
  "TiB",
  "PiB",
  "EiB",
  "ZiB",
  "YiB",
];
export const k8sUnits = ["Ki", "Mi", "Gi", "Ti", "Pi", "Ei"];
export const k8sCalcUnits = ["B", ...k8sUnits];
export const timeUnits = ["ms", "s", "m", "h", "d", "w", "M", "Q", "y"];

export const niceBytes = (x: string, showK8sUnits: boolean = false) => {
  let n = parseInt(x, 10) || 0;

  return niceBytesInt(n, showK8sUnits);
};

export const niceBytesInt = (n: number, showK8sUnits: boolean = false) => {
  let l = 0;

  while (n >= 1024 && ++l) {
    n = n / 1024;
  }
  // include a decimal point and a tenths-place digit if presenting
  // less than ten of KB or greater units
  const k8sUnitsN = ["B", ...k8sUnits];
  return n.toFixed(1) + " " + (showK8sUnits ? k8sUnitsN[l] : units[l]);
};

export const setCookie = (name: string, val: string) => {
  const date = new Date();
  const value = val;

  // Set it expire in 45 minutes
  date.setTime(date.getTime() + 45 * 60 * 1000);

  // Set it
  document.cookie =
    name + "=" + value + "; expires=" + date.toUTCString() + "; path=/";
};

export const deleteCookie = (name: string) => {
  document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
};

export const clearSession = () => {
  storage.removeItem("token");
  storage.removeItem("auth-state");
  deleteCookie("token");
  deleteCookie("idp-refresh-token");
};

// timeFromDate gets time string from date input
export const timeFromDate = (d: Date) => {
  let h = d.getHours() < 10 ? `0${d.getHours()}` : `${d.getHours()}`;
  let m = d.getMinutes() < 10 ? `0${d.getMinutes()}` : `${d.getMinutes()}`;
  let s = d.getSeconds() < 10 ? `0${d.getSeconds()}` : `${d.getSeconds()}`;

  return `${h}:${m}:${s}:${d.getMilliseconds()}`;
};

// units to be used in a dropdown
export const factorForDropdown = () => {
  return units.map((unit) => {
    return { label: unit, value: unit };
  });
};

// units to be used in a dropdown
export const k8sScalarUnitsExcluding = (exclude?: string[]) => {
  return k8sUnits
    .filter((unit) => {
      if (exclude && exclude.includes(unit)) {
        return false;
      }
      return true;
    })
    .map((unit) => {
      return { label: unit, value: unit };
    });
};

//getBytes, converts from a value and a unit from units array to bytes as a string
export const getBytes = (
  value: string,
  unit: string,
  fromk8s: boolean = false,
): string => {
  return getBytesNumber(value, unit, fromk8s).toString(10);
};

//getBytesNumber, converts from a value and a unit from units array to bytes
export const getBytesNumber = (
  value: string,
  unit: string,
  fromk8s: boolean = false,
): number => {
  const vl: number = parseFloat(value);

  const unitsTake = fromk8s ? k8sCalcUnits : units;

  const powFactor = unitsTake.findIndex((element) => element === unit);

  if (powFactor === -1) {
    return 0;
  }
  const factor = Math.pow(1024, powFactor);
  const total = vl * factor;

  return total;
};

//getTotalSize gets the total size of a value & unit
export const getTotalSize = (value: string, unit: string) => {
  const bytes = getBytes(value, unit, true).toString();
  return niceBytes(bytes);
};

export const setMemoryResource = (
  memorySize: number,
  capacitySize: string,
  maxMemorySize: number,
) => {
  // value always comes as Gi
  const requestedSizeBytes = getBytes(memorySize.toString(10), "Gi", true);
  const memReqSize = parseInt(requestedSizeBytes, 10);
  if (maxMemorySize === 0) {
    return {
      error: "There is no memory available for the selected number of nodes",
      request: 0,
      limit: 0,
    };
  }

  if (maxMemorySize < minMemReq) {
    return {
      error: "There are not enough memory resources available",
      request: 0,
      limit: 0,
    };
  }

  if (memReqSize < minMemReq) {
    return {
      error: "The requested memory size must be greater than 2Gi",
      request: 0,
      limit: 0,
    };
  }
  if (memReqSize > maxMemorySize) {
    return {
      error:
        "The requested memory is greater than the max available memory for the selected number of nodes",
      request: 0,
      limit: 0,
    };
  }

  const capSize = parseInt(capacitySize, 10);
  let memLimitSize = memReqSize;
  // set memory limit based on the capacitySize
  // if capacity size is lower than 1TiB we use the limit equal to request
  if (capSize >= parseInt(getBytes("1", "Pi", true), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("64", "Gi", true), 10),
    );
  } else if (capSize >= parseInt(getBytes("100", "Ti"), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("32", "Gi", true), 10),
    );
  } else if (capSize >= parseInt(getBytes("10", "Ti"), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("16", "Gi", true), 10),
    );
  } else if (capSize >= parseInt(getBytes("1", "Ti"), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("8", "Gi", true), 10),
    );
  }

  return {
    error: "",
    request: memReqSize,
    limit: memLimitSize,
  };
};

export const calculateDistribution = (
  capacityToUse: ICapacity,
  forcedNodes: number = 0,
  limitSize: number = 0,
  drivesPerServer: number = 0,
  marketplaceIntegration?: IMkEnvs,
  selectedStorageType?: string,
): IStorageDistribution => {
  const requestedSizeBytes = getBytes(
    capacityToUse.value,
    capacityToUse.unit,
    true,
  );

  if (parseInt(requestedSizeBytes, 10) < minStReq) {
    return {
      error: "The pool size must be greater than 1Gi",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      pvSize: 0,
    };
  }

  if (drivesPerServer <= 0) {
    return {
      error: "Number of drives must be at least 1",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      pvSize: 0,
    };
  }

  let numberOfNodes = calculateStorage(
    requestedSizeBytes,
    forcedNodes,
    limitSize,
    drivesPerServer,
    marketplaceIntegration,
    selectedStorageType,
  );

  return numberOfNodes;
};

const calculateStorage = (
  requestedBytes: string,
  forcedNodes: number,
  limitSize: number,
  drivesPerServer: number,
  marketplaceIntegration?: IMkEnvs,
  selectedStorageType?: string,
): IStorageDistribution => {
  // Size validation
  const intReqBytes = parseInt(requestedBytes, 10);
  const maxDiskSize = minStReq * 256; // 256 GiB

  // We get the distribution
  return structureCalc(
    forcedNodes,
    intReqBytes,
    maxDiskSize,
    limitSize,
    drivesPerServer,
    marketplaceIntegration,
    selectedStorageType,
  );
};

const structureCalc = (
  nodes: number,
  desiredCapacity: number,
  maxDiskSize: number,
  maxClusterSize: number,
  disksPerNode: number = 0,
  marketplaceIntegration?: IMkEnvs,
  selectedStorageType?: string,
): IStorageDistribution => {
  if (
    isNaN(nodes) ||
    isNaN(desiredCapacity) ||
    isNaN(maxDiskSize) ||
    isNaN(maxClusterSize)
  ) {
    return {
      error: "Some provided data is invalid, please try again.",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      pvSize: 0,
    }; // Invalid Data
  }

  let persistentVolumeSize = 0;
  let numberPersistentVolumes = 0;
  let volumesPerServer = 0;

  if (disksPerNode === 0) {
    persistentVolumeSize = Math.floor(
      Math.min(desiredCapacity / Math.max(4, nodes), maxDiskSize),
    ); // pVS = min((desiredCapacity / max(4 | nodes)) | maxDiskSize)

    numberPersistentVolumes = desiredCapacity / persistentVolumeSize; // nPV = dC / pVS
    volumesPerServer = numberPersistentVolumes / nodes; // vPS = nPV / n
  }

  if (disksPerNode) {
    volumesPerServer = disksPerNode;
    numberPersistentVolumes = volumesPerServer * nodes;
    persistentVolumeSize = Math.floor(
      desiredCapacity / numberPersistentVolumes,
    );
  }

  // Volumes are not exact, we force the volumes number & minimize the volume size
  if (volumesPerServer % 1 > 0) {
    volumesPerServer = Math.ceil(volumesPerServer); // Increment of volumes per server
    numberPersistentVolumes = volumesPerServer * nodes; // nPV = vPS * n
    persistentVolumeSize = Math.floor(
      desiredCapacity / numberPersistentVolumes,
    ); // pVS = dC / nPV

    const limitSize = persistentVolumeSize * volumesPerServer * nodes; // lS = pVS * vPS * n

    if (limitSize > maxClusterSize) {
      return {
        error: "We were not able to allocate this server.",
        nodes: 0,
        persistentVolumes: 0,
        disks: 0,
        pvSize: 0,
      }; // Cannot allocate this server
    }
  }

  if (persistentVolumeSize < minStReq) {
    return {
      error:
        "Disk Size with this combination would be less than 1Gi, please try another combination",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      pvSize: 0,
    }; // Cannot allocate this volume size
  }
  // validate for integrations
  if (marketplaceIntegration !== undefined) {
    const setConfigs = mkPanelConfigurations[marketplaceIntegration];
    const keyCount = Object.keys(setConfigs).length;

    //Configuration is filled
    if (keyCount > 0) {
      const configs: IntegrationConfiguration[] = get(
        setConfigs,
        "configurations",
        [],
      );
      const mainSelection = configs.find(
        (item) => item.typeSelection === selectedStorageType,
      );

      if (mainSelection !== undefined && mainSelection.minimumVolumeSize) {
        const minimumPvSize = getBytesNumber(
          mainSelection.minimumVolumeSize?.driveSize,
          mainSelection.minimumVolumeSize?.sizeUnit,
          true,
        );
        const storageTypeLabel = setConfigs.variantSelectorValues!.find(
          (item) => item.value === selectedStorageType,
        );

        if (persistentVolumeSize < minimumPvSize) {
          return {
            error: `For the ${
              storageTypeLabel!.label
            } storage type the mininum volume size is ${
              mainSelection.minimumVolumeSize.driveSize
            }${mainSelection.minimumVolumeSize.sizeUnit}`,
            nodes: 0,
            persistentVolumes: 0,
            disks: 0,
            pvSize: 0,
          };
        }
      }
    }
  }

  return {
    error: "",
    nodes,
    persistentVolumes: numberPersistentVolumes,
    disks: volumesPerServer,
    pvSize: persistentVolumeSize,
  };
};

// Erasure Code Parity Calc
export const erasureCodeCalc = (
  parityValidValues: string[],
  totalDisks: number,
  pvSize: number,
  totalNodes: number,
): IErasureCodeCalc => {
  // Parity Values is empty
  if (parityValidValues.length < 1) {
    return {
      error: 1,
      defaultEC: "",
      erasureCodeSet: 0,
      maxEC: "",
      rawCapacity: "0",
      storageFactors: [],
    };
  }

  const totalStorage = totalDisks * pvSize;
  const maxEC = parityValidValues[0];
  const maxParityNumber = parseInt(maxEC.split(":")[1], 10);

  const erasureStripeSet = maxParityNumber * 2; // ESS is calculated by multiplying maximum parity by two.

  const storageFactors: IStorageFactors[] = parityValidValues.map(
    (currentParity) => {
      const parityNumber = parseInt(currentParity.split(":")[1], 10);
      const storageFactor =
        erasureStripeSet / (erasureStripeSet - parityNumber);

      const maxCapacity = Math.floor(totalStorage / storageFactor);
      const maxTolerations =
        totalDisks - Math.floor(totalDisks / storageFactor);
      return {
        erasureCode: currentParity,
        storageFactor,
        maxCapacity: maxCapacity.toString(10),
        maxFailureTolerations: maxTolerations,
      };
    },
  );

  let defaultEC = maxEC;

  const fourVar = parityValidValues.find((element) => element === "EC:4");

  if (fourVar) {
    defaultEC = "EC:4";
  }

  return {
    error: 0,
    storageFactors,
    maxEC,
    rawCapacity: totalStorage.toString(10),
    erasureCodeSet: erasureStripeSet,
    defaultEC,
  };
};

// Pool Name Generator
export const generatePoolName = (pools: Pool[]) => {
  const poolCounter = pools.length;
  return `pool-${poolCounter}`;
};

// seconds / minutes /hours / Days / Years calculator
export const niceDays = (secondsValue: string, timeVariant: string = "s") => {
  let seconds = parseFloat(secondsValue);

  return niceDaysInt(seconds, timeVariant);
};

export const niceDaysInt = (seconds: number, timeVariant: string = "s") => {
  switch (timeVariant) {
    case "ns":
      seconds = Math.floor(seconds * 0.000000001);
      break;
    case "ms":
      seconds = Math.floor(seconds * 0.001);
      break;
    default:
  }

  const days = Math.floor(seconds / (3600 * 24));

  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;

  if (days > 365) {
    const years = days / 365;
    return `${years} year${Math.floor(years) === 1 ? "" : "s"}`;
  }

  if (days > 30) {
    const months = Math.floor(days / 30);
    const diffDays = days - months * 30;

    return `${months} month${Math.floor(months) === 1 ? "" : "s"} ${
      diffDays > 0 ? `${diffDays} day${diffDays > 1 ? "s" : ""}` : ""
    }`;
  }

  if (days >= 7 && days <= 30) {
    const weeks = Math.floor(days / 7);

    return `${Math.floor(weeks)} week${weeks === 1 ? "" : "s"}`;
  }

  if (days >= 1 && days <= 6) {
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  return `${hours >= 1 ? `${hours} hour${hours > 1 ? "s" : ""}` : ""} ${
    minutes >= 1 && hours === 0
      ? `${minutes} minute${minutes > 1 ? "s" : ""}`
      : ""
  } ${
    seconds >= 1 && minutes === 0 && hours === 0
      ? `${seconds} second${seconds > 1 ? "s" : ""}`
      : ""
  }`;
};

const twoDigitsNumberString = (value: number) => {
  return `${value < 10 ? "0" : ""}${value}`;
};

export const getTimeFromTimestamp = (
  timestamp: string,
  fullDate: boolean = false,
  simplifiedDate: boolean = false,
) => {
  const timestampToInt = parseInt(timestamp);
  if (isNaN(timestampToInt)) {
    return "";
  }
  const dateObject = new Date(timestampToInt * 1000);

  if (fullDate) {
    if (simplifiedDate) {
      return `${twoDigitsNumberString(
        dateObject.getMonth() + 1,
      )}/${twoDigitsNumberString(dateObject.getDate())} ${twoDigitsNumberString(
        dateObject.getHours(),
      )}:${twoDigitsNumberString(dateObject.getMinutes())}`;
    } else {
      return dateObject.toLocaleString();
    }
  }
  return `${dateObject.getHours()}:${String(dateObject.getMinutes()).padStart(
    2,
    "0",
  )}`;
};

export const calculateBytes = (
  x: string | number,
  showDecimals = false,
  roundFloor = true,
  k8sUnit = false,
): IBytesCalc => {
  let bytes;

  if (typeof x === "string") {
    bytes = parseInt(x, 10);
  } else {
    bytes = x;
  }

  if (bytes === 0) {
    return { total: 0, unit: units[0] };
  }

  // Gi : GiB
  const k = 1024;

  // Get unit for measure
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const fractionDigits = showDecimals ? 1 : 0;

  const bytesUnit = bytes / Math.pow(k, i);

  const roundedUnit = roundFloor ? Math.floor(bytesUnit) : bytesUnit;

  // Get Unit parsed
  const unitParsed = parseFloat(roundedUnit.toFixed(fractionDigits));
  const finalUnit = k8sUnit ? k8sCalcUnits[i] : units[i];

  return { total: unitParsed, unit: finalUnit };
};

export const nsToSeconds = (nanoseconds: number) => {
  const conversion = nanoseconds * 0.000000001;
  const round = Math.round((conversion + Number.EPSILON) * 10000) / 10000;

  return `${round} s`;
};

export const textToRGBColor = (text: string) => {
  const splitText = text.split("");

  const hashVl = splitText.reduce((acc, currItem) => {
    return acc + currItem.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const hashColored = ((hashVl * 100) & 0x00ffffff).toString(16).toUpperCase();

  return `#${hashColored.padStart(6, "0")}`;
};

export const prettyNumber = (usage: number | undefined) => {
  if (usage === undefined) {
    return 0;
  }

  return usage.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const representationNumber = (number: number | undefined) => {
  if (number === undefined) {
    return "0";
  }

  let returnValue = number.toString();
  let unit = "";

  if (number > 999 && number < 1000000) {
    returnValue = (number / 1000).toFixed(1); // convert to K, numbers > 999
    unit = "K";
  } else if (number >= 1000000 && number < 1000000000) {
    returnValue = (number / 1000000).toFixed(1); // convert to M, numbers >= 1 million
    unit = "M";
  } else if (number >= 1000000000) {
    returnValue = (number / 1000000000).toFixed(1); // convert to B, numbers >= 1 billion
    unit = "B";
  }

  if (returnValue.endsWith(".0")) {
    returnValue = returnValue.slice(0, -2);
  }

  return `${returnValue}${unit}`;
};

export const encodeURLString = (name: string | number | null) => {
  if (!name) {
    return "";
  }
  try {
    return btoa(unescape(encodeURIComponent(name)));
  } catch (err) {
    return "";
  }
};

export const decodeURLString = (text: string) => {
  try {
    return decodeURIComponent(escape(window.atob(text)));
  } catch (err) {
    return text;
  }
};

export const performDownload = (blob: Blob, fileName: string) => {
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getCookieValue = (cookieName: string) => {
  return (
    document.cookie
      .match("(^|;)\\s*" + cookieName + "\\s*=\\s*([^;]+)")
      ?.pop() || ""
  );
};

export const capacityColors = (usedSpace: number, maxSpace: number) => {
  const percCalculate = (usedSpace * 100) / maxSpace;

  if (percCalculate >= 90) {
    return "#C83B51";
  } else if (percCalculate >= 70) {
    return "#FFAB0F";
  }

  return "#07193E";
};

export const getClientOS = (): string => {
  const getPlatform = get(window.navigator, "platform", "undefined");

  if (!getPlatform) {
    return "undefined";
  }

  return getPlatform;
};

export const MinIOEnvVarsSettings: any = {
  MINIO_ACCESS_KEY: { secret: true },
  MINIO_ACCESS_KEY_OLD: { secret: true },
  MINIO_AUDIT_WEBHOOK_AUTH_TOKEN: { secret: true },
  MINIO_IDENTITY_LDAP_LOOKUP_BIND_PASSWORD: { secret: true },
  MINIO_IDENTITY_OPENID_CLIENT_SECRET: { secret: true },
  MINIO_KMS_SECRET_KEY: { secret: true },
  MINIO_LOGGER_WEBHOOK_AUTH_TOKEN: { secret: true },
  MINIO_NOTIFY_ELASTICSEARCH_PASSWORD: { secret: true },
  MINIO_NOTIFY_KAFKA_SASL_PASSWORD: { secret: true },
  MINIO_NOTIFY_MQTT_PASSWORD: { secret: true },
  MINIO_NOTIFY_NATS_PASSWORD: { secret: true },
  MINIO_NOTIFY_NATS_TOKEN: { secret: true },
  MINIO_NOTIFY_REDIS_PASSWORD: { secret: true },
  MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN: { secret: true },
  MINIO_ROOT_PASSWORD: { secret: true },
  MINIO_SECRET_KEY: { secret: true },
  MINIO_SECRET_KEY_OLD: { secret: true },
};

export const MinIOEnvironmentVariables = [
  "MINIO_ACCESS_KEY",
  "MINIO_ACCESS_KEY_OLD",
  "MINIO_AUDIT_WEBHOOK_AUTH_TOKEN",
  "MINIO_AUDIT_WEBHOOK_CLIENT_CERT",
  "MINIO_AUDIT_WEBHOOK_CLIENT_KEY",
  "MINIO_AUDIT_WEBHOOK_ENABLE",
  "MINIO_AUDIT_WEBHOOK_ENDPOINT",
  "MINIO_BROWSER",
  "MINIO_BROWSER_REDIRECT_URL",
  "MINIO_IDENTITY_LDAP_COMMENT",
  "MINIO_IDENTITY_LDAP_GROUP_SEARCH_BASE_DN",
  "MINIO_IDENTITY_LDAP_GROUP_SEARCH_FILTER",
  "MINIO_IDENTITY_LDAP_LOOKUP_BIND_DN",
  "MINIO_IDENTITY_LDAP_LOOKUP_BIND_PASSWORD",
  "MINIO_IDENTITY_LDAP_SERVER_ADDR",
  "MINIO_IDENTITY_LDAP_SERVER_INSECURE",
  "MINIO_IDENTITY_LDAP_SERVER_STARTTLS",
  "MINIO_IDENTITY_LDAP_STS_EXPIRY",
  "MINIO_IDENTITY_LDAP_TLS_SKIP_VERIFY",
  "MINIO_IDENTITY_LDAP_USER_DN_SEARCH_BASE_DN",
  "MINIO_IDENTITY_LDAP_USER_DN_SEARCH_FILTER",
  "MINIO_IDENTITY_LDAP_USERNAME_FORMAT",
  "MINIO_IDENTITY_OPENID_CLAIM_NAME",
  "MINIO_IDENTITY_OPENID_CLAIM_PREFIX",
  "MINIO_IDENTITY_OPENID_CLIENT_ID",
  "MINIO_IDENTITY_OPENID_CLIENT_SECRET",
  "MINIO_IDENTITY_OPENID_COMMENT",
  "MINIO_IDENTITY_OPENID_CONFIG_URL",
  "MINIO_IDENTITY_OPENID_SCOPES",
  "MINIO_KMS_AUTO_ENCRYPTION",
  "MINIO_KMS_KES_CERT_FILE",
  "MINIO_KMS_KES_ENDPOINT",
  "MINIO_KMS_KES_KEY_FILE",
  "MINIO_KMS_KES_KEY_NAME",
  "MINIO_KMS_SECRET_KEY",
  "MINIO_LOGGER_WEBHOOK_AUTH_TOKEN",
  "MINIO_LOGGER_WEBHOOK_ENABLE",
  "MINIO_LOGGER_WEBHOOK_ENDPOINT",
  "MINIO_LOG_QUERY_URL",
  "MINIO_NOTIFY_AMQP_AUTO_DELETED",
  "MINIO_NOTIFY_AMQP_COMMENT",
  "MINIO_NOTIFY_AMQP_DELIVERY_MODE",
  "MINIO_NOTIFY_AMQP_DURABLE",
  "MINIO_NOTIFY_AMQP_ENABLE",
  "MINIO_NOTIFY_AMQP_EXCHANGE",
  "MINIO_NOTIFY_AMQP_EXCHANGE_TYPE",
  "MINIO_NOTIFY_AMQP_INTERNAL",
  "MINIO_NOTIFY_AMQP_MANDATORY",
  "MINIO_NOTIFY_AMQP_NO_WAIT",
  "MINIO_NOTIFY_AMQP_QUEUE_DIR",
  "MINIO_NOTIFY_AMQP_QUEUE_LIMIT",
  "MINIO_NOTIFY_AMQP_ROUTING_KEY",
  "MINIO_NOTIFY_AMQP_URL",
  "MINIO_NOTIFY_ELASTICSEARCH_COMMENT",
  "MINIO_NOTIFY_ELASTICSEARCH_ENABLE",
  "MINIO_NOTIFY_ELASTICSEARCH_FORMAT",
  "MINIO_NOTIFY_ELASTICSEARCH_INDEX",
  "MINIO_NOTIFY_ELASTICSEARCH_PASSWORD",
  "MINIO_NOTIFY_ELASTICSEARCH_QUEUE_DIR",
  "MINIO_NOTIFY_ELASTICSEARCH_QUEUE_LIMIT",
  "MINIO_NOTIFY_ELASTICSEARCH_URL",
  "MINIO_NOTIFY_ELASTICSEARCH_USERNAME",
  "MINIO_NOTIFY_KAFKA_BROKERS",
  "MINIO_NOTIFY_KAFKA_CLIENT_TLS_CERT",
  "MINIO_NOTIFY_KAFKA_CLIENT_TLS_KEY",
  "MINIO_NOTIFY_KAFKA_COMMENT",
  "MINIO_NOTIFY_KAFKA_ENABLE",
  "MINIO_NOTIFY_KAFKA_QUEUE_DIR",
  "MINIO_NOTIFY_KAFKA_QUEUE_LIMIT",
  "MINIO_NOTIFY_KAFKA_SASL",
  "MINIO_NOTIFY_KAFKA_SASL_MECHANISM",
  "MINIO_NOTIFY_KAFKA_SASL_PASSWORD",
  "MINIO_NOTIFY_KAFKA_SASL_USERNAME",
  "MINIO_NOTIFY_KAFKA_TLS",
  "MINIO_NOTIFY_KAFKA_TLS_CLIENT_AUTH",
  "MINIO_NOTIFY_KAFKA_TLS_SKIP_VERIFY",
  "MINIO_NOTIFY_KAFKA_TOPIC",
  "MINIO_NOTIFY_KAFKA_VERSION",
  "MINIO_NOTIFY_MQTT_BROKER",
  "MINIO_NOTIFY_MQTT_COMMENT",
  "MINIO_NOTIFY_MQTT_ENABLE",
  "MINIO_NOTIFY_MQTT_KEEP_ALIVE_INTERVAL",
  "MINIO_NOTIFY_MQTT_PASSWORD",
  "MINIO_NOTIFY_MQTT_QOS",
  "MINIO_NOTIFY_MQTT_QUEUE_DIR",
  "MINIO_NOTIFY_MQTT_QUEUE_LIMIT",
  "MINIO_NOTIFY_MQTT_RECONNECT_INTERVAL",
  "MINIO_NOTIFY_MQTT_TOPIC",
  "MINIO_NOTIFY_MQTT_USERNAME",
  "MINIO_NOTIFY_MYSQL_COMMENT",
  "MINIO_NOTIFY_MYSQL_DSN_STRING",
  "MINIO_NOTIFY_MYSQL_ENABLE",
  "MINIO_NOTIFY_MYSQL_FORMAT",
  "MINIO_NOTIFY_MYSQL_MAX_OPEN_CONNECTIONS",
  "MINIO_NOTIFY_MYSQL_QUEUE_DIR",
  "MINIO_NOTIFY_MYSQL_QUEUE_LIMIT",
  "MINIO_NOTIFY_MYSQL_TABLE",
  "MINIO_NOTIFY_NATS_ADDRESS",
  "MINIO_NOTIFY_NATS_CERT_AUTHORITY",
  "MINIO_NOTIFY_NATS_CLIENT_CERT",
  "MINIO_NOTIFY_NATS_CLIENT_KEY",
  "MINIO_NOTIFY_NATS_COMMENT",
  "MINIO_NOTIFY_NATS_ENABLE",
  "MINIO_NOTIFY_NATS_PASSWORD",
  "MINIO_NOTIFY_NATS_PING_INTERVAL",
  "MINIO_NOTIFY_NATS_QUEUE_DIR",
  "MINIO_NOTIFY_NATS_QUEUE_LIMIT",
  "MINIO_NOTIFY_NATS_STREAMING",
  "MINIO_NOTIFY_NATS_STREAMING_ASYNC",
  "MINIO_NOTIFY_NATS_STREAMING_CLUSTER_ID",
  "MINIO_NOTIFY_NATS_STREAMING_MAX_PUB_ACKS_IN_FLIGHT",
  "MINIO_NOTIFY_NATS_SUBJECT",
  "MINIO_NOTIFY_NATS_TLS",
  "MINIO_NOTIFY_NATS_TLS_SKIP_VERIFY",
  "MINIO_NOTIFY_NATS_TOKEN",
  "MINIO_NOTIFY_NATS_USERNAME",
  "MINIO_NOTIFY_NSQ_COMMENT",
  "MINIO_NOTIFY_NSQ_ENABLE",
  "MINIO_NOTIFY_NSQ_NSQD_ADDRESS",
  "MINIO_NOTIFY_NSQ_QUEUE_DIR",
  "MINIO_NOTIFY_NSQ_QUEUE_LIMIT",
  "MINIO_NOTIFY_NSQ_TLS",
  "MINIO_NOTIFY_NSQ_TLS_SKIP_VERIFY",
  "MINIO_NOTIFY_NSQ_TOPIC",
  "MINIO_NOTIFY_POSTGRESQL_COMMENT",
  "MINIO_NOTIFY_POSTGRESQL_CONNECTION_STRING",
  "MINIO_NOTIFY_POSTGRESQL_ENABLE",
  "MINIO_NOTIFY_POSTGRESQL_FORMAT",
  "MINIO_NOTIFY_POSTGRESQL_MAX_OPEN_CONNECTIONS",
  "MINIO_NOTIFY_POSTGRESQL_QUEUE_DIR",
  "MINIO_NOTIFY_POSTGRESQL_QUEUE_LIMIT",
  "MINIO_NOTIFY_POSTGRESQL_TABLE",
  "MINIO_NOTIFY_REDIS_ADDRESS",
  "MINIO_NOTIFY_REDIS_COMMENT",
  "MINIO_NOTIFY_REDIS_ENABLE",
  "MINIO_NOTIFY_REDIS_FORMAT",
  "MINIO_NOTIFY_REDIS_KEY",
  "MINIO_NOTIFY_REDIS_PASSWORD",
  "MINIO_NOTIFY_REDIS_QUEUE_DIR",
  "MINIO_NOTIFY_REDIS_QUEUE_LIMIT",
  "MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN",
  "MINIO_NOTIFY_WEBHOOK_CLIENT_CERT",
  "MINIO_NOTIFY_WEBHOOK_CLIENT_KEY",
  "MINIO_NOTIFY_WEBHOOK_COMMENT",
  "MINIO_NOTIFY_WEBHOOK_ENABLE",
  "MINIO_NOTIFY_WEBHOOK_ENDPOINT",
  "MINIO_NOTIFY_WEBHOOK_QUEUE_DIR",
  "MINIO_NOTIFY_WEBHOOK_QUEUE_LIMIT",
  "MINIO_PROMETHEUS_AUTH_TYPE",
  "MINIO_PROMETHEUS_JOB_ID",
  "MINIO_PROMETHEUS_URL",
  "MINIO_ROOT_PASSWORD",
  "MINIO_ROOT_USER",
  "MINIO_SECRET_KEY",
  "MINIO_SECRET_KEY_OLD",
  "MINIO_SERVER_URL",
  "MINIO_STORAGE_CLASS_COMMENT",
  "MINIO_STORAGE_CLASS_RRS",
  "MINIO_STORAGE_CLASS_STANDARD",
];
