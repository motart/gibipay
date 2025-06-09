import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { ConsoleLogger } from 'aws-amplify/utils';
import { Table, TableHead, TableRow, TableCell, TableBody, Button, View, Heading, TextField } from '@aws-amplify/ui-react';
import { getItems as GetItems, getAccounts as GetAccounts, getTransactions as GetTransactions } from '../graphql/queries';
import Transaction from '../components/Transaction';

const logger = new ConsoleLogger('Portfolio');

export default function Portfolio() {
  const client = generateClient();
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('');

  // load all accounts for current user
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await client.graphql({ query: GetItems });
        const items = res.data.getItems.items || [];
        let all = [];
        for (const item of items) {
          const accRes = await client.graphql({ query: GetAccounts, variables: { id: item.item_id } });
          const accounts = accRes.data.getAccounts.map(a => ({ ...a, item_id: item.item_id }));
          all = [...all, ...accounts];
        }
        setAvailableAccounts(all);
      } catch (err) {
        logger.error('unable to load accounts', err);
      }
    };
    loadAccounts();
  }, []);

  const refreshTransactions = async (selected) => {
    if (!selected.length) {
      setTransactions([]);
      return;
    }
    const grouped = {};
    selected.forEach(acc => {
      if (!grouped[acc.item_id]) grouped[acc.item_id] = [];
      grouped[acc.item_id].push(acc.account_id);
    });
    let allTx = [];
    for (const [itemId, ids] of Object.entries(grouped)) {
      try {
        const res = await client.graphql({ query: GetTransactions, variables: { id: itemId, limit: 50 } });
        const tx = res.data.getTransactions.transactions.filter(t => ids.includes(t.account_id));
        allTx = [...allTx, ...tx];
      } catch (err) {
        logger.error('unable to load transactions', err);
      }
    }
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(allTx);
  };

  const addCard = async (account) => {
    if (portfolio.find(p => p.account_id === account.account_id)) return;
    const updated = [...portfolio, account];
    setPortfolio(updated);
    await refreshTransactions(updated);
  };

  const removeCard = async (accountId) => {
    const updated = portfolio.filter(p => p.account_id !== accountId);
    setPortfolio(updated);
    await refreshTransactions(updated);
  };

  const displayed = transactions.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <View>
      <Heading level={4}>Available Accounts</Heading>
      <Table highlightOnHover variation="striped">
        <TableHead>
          <TableRow>
            <TableCell as="th">Name</TableCell>
            <TableCell as="th">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {availableAccounts.map(acc => (
            <TableRow key={acc.account_id}>
              <TableCell>{acc.name}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => addCard(acc)} isDisabled={portfolio.some(p => p.account_id === acc.account_id)}>Add</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Heading level={4}>Portfolio</Heading>
      <Table highlightOnHover variation="striped">
        <TableHead>
          <TableRow>
            <TableCell as="th">Name</TableCell>
            <TableCell as="th">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {portfolio.map(acc => (
            <TableRow key={acc.account_id}>
              <TableCell>{acc.name}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => removeCard(acc.account_id)}>Remove</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Heading level={4}>Transactions</Heading>
      <TextField label="Filter" placeholder="filter by name" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Table highlightOnHover variation="striped">
        <TableHead>
          <TableRow>
            <TableCell as="th">Name</TableCell>
            <TableCell as="th">Amount</TableCell>
            <TableCell as="th">Date</TableCell>
            <TableCell as="th">Account</TableCell>
            <TableCell as="th">Payment Channel</TableCell>
            <TableCell as="th">Transaction Type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayed.map(tx => (
            <Transaction key={tx.transaction_id} transaction={tx} account={portfolio.find(p => p.account_id === tx.account_id)} />
          ))}
        </TableBody>
      </Table>
    </View>
  );
}
