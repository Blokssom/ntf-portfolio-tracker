import axios from 'axios'

// constants
const apiUrl = 'https://api.blokness.com'
const apiKey = '<Your Blokness API key>'
const wallet = '<Your wallet address>'
const mintAddress = '0x0000000000000000000000000000000000000000'
const burnAddresses = [mintAddress, '0x000000000000000000000000000000000000dead']

// api requests
const getFromApi = async url => {
  try {
    const { data } = await axios.get(url, { headers: { 'x-api-key': apiKey } })

    return data.data
  } catch (err) {
    console.log(`Unable to fetch data - ${err}`)
  }
}

const getNftsByWallet = wallet => getFromApi(`${apiUrl}nfts?wallet=${wallet}`)
const getNftTxsByWallet = wallet => getFromApi(`${apiUrl}transactions?wallet=${wallet}`)

// formatter helper functions
const formatAddress = address => `${address.substring(0, 5)}..${address.substring(38)}`

const formatDate = date => {
  const dateObj = new Date(date)
  const dateStr = dateObj.toISOString().slice(0, 10)
  const hoursStr = `00${dateObj.getHours()}`.slice(-2)
  const minutesStr = `00${dateObj.getMinutes()}`.slice(-2)

  return `${dateStr} ${hoursStr}:${minutesStr}`
}

// grouping functions and helpers to be used as callbacks
const setNftTxDetails = ({ wallet, to, from, value }) => {
  if (from === mintAddress)
    return ({ action: 'Minted' })
  if (wallet === to && value === 0)
    return ({ action: 'Recieved', from })
  if (wallet === to && value > 0)
    return ({ action: 'Bought', from, value })
  if (burnAddresses.includes(to))
    return ({ action: 'Burned' })
  if (wallet === from && value === 0)
    return  ({ action: 'Sent', to })
  return ({ action: 'Sold', to, value })
}

const groupWalletTransactionsByCollection = (acc, {
  collection_address: address,
  collection_name: collectionName,
  date,
  token_ids: tokenIds,
  address_to: to,
  address_from: from,
  value,
}) => ({
  ...acc,
  [`${address}\t${collectionName}`]: [
    ...(acc[`${address}\t${collectionName}`] || []),
    {
      collectionName,
      date: formatDate(date),
      amount: tokenIds.length,
      ...setNftTxDetails({ wallet, to, from, value })
    },
  ]
})

const groupBalanceByCollection = (acc, {
  collection_address: address,
  collection_name: collectionName
}) => ({
  ...acc,
  [address]: {
    collectionName,
    balance: (acc[address]?.balance || 0) + 1
  }
})

// logging helpers and functions
const logCollectionBalance = ({ collectionName, balance }) => {
  console.log(`\t${balance}: ${collectionName}`)
}

const logCollectionTransactions = ({ collectionsArray, transactionsObj }) => {
  collectionsArray.forEach(addressAndName => {
    const [_, collectionName] = addressAndName.split('\t')

    console.log(`\n\t${collectionName}`)

    transactionsObj[addressAndName].forEach(({ action, amount, from, to, value, date }) => {
      let activity = `\t\t${date} -> ${action} ${amount}`
      if (!!value) activity += ` for ${value} ETH`
      if (from) activity += ` from ${formatAddress(from)}`
      if (to) activity += ` to ${formatAddress(to)}`

      console.log(activity)
    })
  })
}

const logOwnedNfts = nfts => {
  console.log(`\n=== WALLET ===\n`)
  console.log(`\t${wallet}`)
  console.log('\n\n=== NFT BLOCKFOLIO ===\n')

  const ownedCollectionsBalance = nfts.reduce(groupBalanceByCollection, {})
  const ownedCollectionsBalanceArray = Object.values(ownedCollectionsBalance)
  ownedCollectionsBalanceArray.forEach(logCollectionBalance)
}

const logNftActivity = nftTxs => {
  console.log('\n\n=== NFT ACTIVITY ===')

  const transactionsObj = nftTxs.reduce(groupWalletTransactionsByCollection, {})
  const collectionsArray = Object.keys(transactionsObj)
  logCollectionTransactions({ collectionsArray, transactionsObj })
}

// entry point
const main = async () => {
  const [nfts, nftTxs] = await Promise.all([
    getNftsByWallet(wallet),
    getNftTxsByWallet(wallet)
  ])

  logOwnedNfts(nfts)
  logNftActivity(nftTxs)
}

main()
